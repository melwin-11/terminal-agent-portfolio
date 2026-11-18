/*
 * tools.js
 *
 * The tools the model can call, each with a declaration (name, description and
 * parameters, sent to Gemini), an implementation, and a one-line summary shown
 * in the terminal and stored in traces.
 *
 *   get_experience      internships and jobs from the knowledge file
 *   get_education       degrees and schools
 *   get_projects        projects, filterable by keyword
 *   get_research        curated research work, filterable by keyword
 *   get_skills          skills grouped by category
 *   get_links           website, LinkedIn, GitHub, ORCID, email
 *   get_live_activity   live: latest GitHub repositories and ORCID publications
 *
 * The descriptions are the part that decides whether the model picks the right
 * tool, so tune them against live questions and npm run trace. A good description
 * says what the tool returns and when to use it, and names what it is not for.
 *
 * Keyword filters score each entry by how many query words appear anywhere in
 * it; when nothing matches the tool returns the available names so the model can
 * retry. Lists are returned newest first, with ongoing entries (end: null) on top.
 *
 * Live sources are cached in memory for one hour. GitHub allows 60 anonymous
 * requests per hour per address, which a shared address such as the Worker's can
 * exhaust, so setToolConfig({ githubToken }) raises the limit when a token is
 * provided. ORCID's public API needs no key. A failing
 * source returns an error object instead of throwing, so the model can say the
 * source is unavailable. Runs in Node and in the Worker.
 */
import { links, experience, education, projects, research, skills } from "../knowledge/knowledge.js";

const CACHE_MS = 60 * 60 * 1000;
const cache = new Map();
const config = {};

export function setToolConfig(options) {
  Object.assign(config, options);
}

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const settle = async (load) => {
  try {
    return { items: await load() };
  } catch (err) {
    return { error: err.message };
  }
};

const stem = (w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const when = (e) => (e.end === null ? "9999-12" : (e.end ?? e.date ?? e.start ?? "")) + (e.start ?? "");
const newestFirst = (list) => [...list].sort((a, b) => when(b).localeCompare(when(a)));
const decorate = (e) => ("end" in e ? { ...e, current: e.end === null } : e);

function find(list, query, label) {
  const words = String(query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 1)
    .map(stem);
  if (!words.length) {
    const items = newestFirst(list).map(decorate);
    return { count: items.length, items };
  }
  const scored = list
    .map((e) => {
      const text = JSON.stringify(e).toLowerCase();
      return { e, score: words.filter((w) => text.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || when(b.e).localeCompare(when(a.e)));
  if (!scored.length) {
    return { count: 0, items: [], note: "No entry matched. Retry without a query to see everything.", available: list.map(label) };
  }
  const items = scored.map((x) => decorate(x.e));
  return { count: items.length, items };
}

const githubUser = () => links.github?.match(/github\.com\/([^/?#]+)/i)?.[1];
const orcidId = () => links.orcid?.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0];

async function githubRepos(user) {
  const res = await fetch(`https://api.github.com/users/${user}/repos?sort=pushed&direction=desc&per_page=20`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "portfolio-agent",
      ...(config.githubToken ? { authorization: `Bearer ${config.githubToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const repos = await res.json();
  return repos
    .filter((r) => !r.fork)
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      description: r.description?.slice(0, 200) ?? null,
      language: r.language,
      topics: r.topics ?? [],
      stars: r.stargazers_count,
      last_pushed: r.pushed_at?.slice(0, 10),
      url: r.html_url,
    }));
}

async function orcidWorks(id) {
  const res = await fetch(`https://pub.orcid.org/v3.0/${id}/works`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ORCID responded ${res.status}`);
  const data = await res.json();
  return (data.group ?? [])
    .map((g) => g["work-summary"]?.[0])
    .filter(Boolean)
    .map((w) => {
      const doi = w["external-ids"]?.["external-id"]?.find((x) => x["external-id-type"] === "doi")?.["external-id-value"];
      return {
        title: w.title?.title?.value ?? null,
        type: w.type ?? null,
        year: w["publication-date"]?.year?.value ?? null,
        venue: w["journal-title"]?.value ?? null,
        url: w.url?.value ?? (doi ? `https://doi.org/${doi}` : null),
      };
    })
    .sort((a, b) => String(b.year ?? "").localeCompare(String(a.year ?? "")))
    .slice(0, 10);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const queryParam = (what) => ({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: `Optional keywords to filter ${what}, such as a technology, organization or topic. Omit to list everything.`,
    },
  },
});

export const tools = [
  {
    name: "get_experience",
    description:
      "Internships and jobs: organization, role, dates, what was built, technologies. Use for any question about work history, internships or industry experience.",
    parameters: queryParam("experience"),
    run: ({ query }) => find(experience, query, (e) => e.org),
    summarize: (r) => plural(r.count, "role"),
  },
  {
    name: "get_education",
    description: "Degrees and schools with dates, grades and highlights. Use for any question about education, university or studies.",
    run: () => find(education, "", (e) => e.school),
    summarize: (r) => plural(r.count, "entry").replace("entrys", "entries"),
  },
  {
    name: "get_projects",
    description:
      "Personal and team projects with summary, technologies, status and links. Use for questions about what was built, side projects or specific technologies.",
    parameters: queryParam("projects"),
    run: ({ query }) => find(projects, query, (e) => e.name),
    summarize: (r) => plural(r.count, "project"),
  },
  {
    name: "get_research",
    description:
      "Curated research work: papers, theses, preprints and ongoing studies with venue, status and summary. Use for questions about research or publications. For the live ORCID list use get_live_activity.",
    parameters: queryParam("research"),
    run: ({ query }) => find(research, query, (e) => e.title),
    summarize: (r) => plural(r.count, "entry").replace("entrys", "entries"),
  },
  {
    name: "get_skills",
    description:
      "Technical and soft skills grouped by category: programming languages, developer tools, libraries and frameworks, cloud and DevOps. Use for questions about skills, technologies or what the owner is proficient in.",
    run: () => ({ count: Object.keys(skills).length, skills }),
    summarize: (r) => `${r.count} ${r.count === 1 ? "category" : "categories"}`,
  },
  {
    name: "get_links",
    description: "Public profile links: website, LinkedIn, GitHub, ORCID and email. Use when someone asks where to find or contact the owner.",
    run: () => ({ count: Object.keys(links).length, links }),
    summarize: (r) => plural(r.count, "link"),
  },
  {
    name: "get_live_activity",
    description:
      "Live data from public sources: the most recently pushed GitHub repositories and the publications listed on ORCID. Use when asked for latest public code activity or newly listed publications. General current work and role interests are in the profile summary. Not for work history or curated project details.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["github", "orcid", "both"], description: "Which source to read. Defaults to both." },
      },
    },
    run: async ({ source }) => {
      const out = {};
      const user = githubUser();
      const id = orcidId();
      if (source !== "orcid") out.github = user ? await settle(() => cached(`gh:${user}`, () => githubRepos(user))) : { error: "No GitHub profile configured" };
      if (source !== "github") out.orcid = id ? await settle(() => cached(`orcid:${id}`, () => orcidWorks(id))) : { error: "No ORCID configured" };
      return out;
    },
    summarize: (r) =>
      Object.entries(r)
        .map(([name, v]) => (v.error ? `${name} unavailable` : `${name} ${plural(v.items.length, "item")}`))
        .join(", "),
  },
];

export const declarations = tools.map(({ name, description, parameters }) => ({
  name,
  description,
  ...(parameters ? { parameters } : {}),
}));

export async function runTool(name, args) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool "${name}"`);
  const result = await tool.run(args ?? {});
  return { result, summary: tool.summarize(result) };
}
