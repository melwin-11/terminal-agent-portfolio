#!/usr/bin/env node
/*
 * main.js
 *
 * Terminal portfolio that mimics the Claude Code interface. Visitors type
 * questions and an AI agent answers on the owner's behalf using the facts in
 * profile.js.
 *
 * Screen layout, top to bottom:
 *   1. Welcome banner  rounded box, two columns, mascot, tips
 *   2. Conversation    user messages on a grey band, replies behind a bullet,
 *                      local command output behind a hook arrow
 *   3. Input area      rule, "> " prompt, rule, footer (hint, shortcuts or
 *                      slash-command menu)
 *
 * Input: raw-mode line editor with a drawn block cursor, bracketed paste,
 * history (up/down), home/end, ctrl+u / ctrl+k / ctrl+w, and a slash-command
 * menu (up/down to select, tab to complete, enter to run).
 *
 * Tool calls: each tool the agent uses is shown as a bullet line with its
 * arguments and a one-line result summary beneath it. Set showTools to false
 * in profile.js to hide them.
 *
 * Replies: streamed text is word-wrapped to the terminal width as it arrives.
 * **bold**, `code` and leading "- " list markers are styled; nothing else is
 * interpreted as markdown.
 *
 * Colors use the 256-color palette so they work in Windows Terminal, iTerm2,
 * Terminal.app and most Linux terminals. Esc or ctrl+c interrupts a reply.
 *
 * Environment:
 *   GEMINI_API_KEY      call Gemini directly (development); use ANTHROPIC_API_KEY
 *                       instead when profile.provider is "anthropic"
 *   PORTFOLIO_TRANSPORT choose "hosted" (default), "local", or "auto"
 *   PORTFOLIO_API_URL   override the hosted proxy endpoint
 *   PORTFOLIO_MODEL     override the model in direct mode
 *   PORTFOLIO_TIMEOUT_MS  optional; limit in milliseconds for each model call (default 45000)
 *   GITHUB_TOKEN        optional; raises GitHub's rate limit for live repository lookups
 *   PORTFOLIO_PRIVATE   set to 1 to ask the hosted agent not to store your question text
 */
import { profile } from "./profile.js";
import { streamReply, isHosted } from "./agent.js";

const sgr = (code) => `\x1b[${code}m`;
const fg = (n) => sgr(`38;5;${n}`);
const S = {
  reset: sgr(0),
  bold: sgr(1),
  inverse: sgr(7),
  accent: fg(173),
  dim: fg(245),
  rule: fg(240),
  error: fg(167),
  band: sgr("48;5;236"),
};

const MASCOT = [" ▐▛███▜▌ ", "▝▜█████▛▘", "  ▘▘ ▝▝  "];
const FRAMES = ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢"];
const VERBS = ["Pondering", "Cogitating", "Noodling", "Ruminating", "Percolating", "Consulting the résumé"];
const KEY = /\x1b\[[0-9;?]*[A-Za-z~]|\x1bO[A-Z]|\x1b|\r\n|[\s\S]/gu;

const PRIVACY_NOTE = "Questions are logged to improve this agent. Type /privacy for details.";

const out = (s) => process.stdout.write(s);
const cols = () => process.stdout.columns || 80;
const paint = (color, s) => `${color}${s}${S.reset}`;
const vlen = (s) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const fit = (s, w) => ([...s].length > w ? [...s].slice(0, Math.max(0, w - 1)).join("") + "…" : s);
const padEnd = (s, w) => s + " ".repeat(Math.max(0, w - vlen(s)));
const center = (s, w) => {
  const gap = Math.max(0, w - vlen(s));
  const left = Math.floor(gap / 2);
  return " ".repeat(left) + s + " ".repeat(gap - left);
};

function wrap(text, w) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && [...line].length + 1 + [...word].length > w) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const COMMANDS = [
  { name: "/about", desc: `Meet ${profile.name}`, ask: `Give a short introduction to ${profile.name}.` },
  { name: "/experience", desc: "Work history", ask: `Summarize ${profile.name}'s work experience.` },
  { name: "/projects", desc: "Notable projects", ask: `What are ${profile.name}'s most notable projects?` },
  { name: "/skills", desc: "Technical skills", ask: `What are ${profile.name}'s core technical skills?` },
  { name: "/contact", desc: "How to reach out", run: showContact },
  { name: "/privacy", desc: "What gets logged", run: showPrivacy },
  { name: "/help", desc: "Show commands", run: showHelp },
  { name: "/clear", desc: "Clear the conversation", run: clearScreen },
  { name: "/exit", desc: "Quit", run: quit },
];

const state = {
  chars: [],
  cur: 0,
  history: [],
  hi: -1,
  draft: [],
  help: false,
  paste: false,
  sel: 0,
  busy: false,
  drawn: 0,
  messages: [],
  abort: null,
  hint: pick(profile.examples),
};

const text = () => state.chars.join("");

function banner() {
  const width = Math.max(30, Math.min(cols() - 2, 112));
  const inner = width - 2;
  const wide = inner >= 70;
  const leftW = wide ? Math.floor((inner - 1) * 0.48) : inner;
  const rightW = inner - leftW - 1;
  const A = (s) => paint(S.accent, s);

  const left = [
    "",
    paint(S.bold, fit("Welcome, visitor!", leftW)),
    "",
    ...MASCOT.map(A),
    "",
    paint(S.dim, fit(profile.name, leftW - 2)),
    paint(S.dim, fit(`${profile.role} · ${profile.location}`, leftW - 2)),
  ];
  const right = wide
    ? [
        paint(S.bold + S.accent, fit("Tips for getting started", rightW - 2)),
        ...wrap(profile.tips, rightW - 2).map((line) => paint(S.dim, line)),
        A("─".repeat(rightW - 2)),
        paint(S.bold + S.accent, "Currently"),
        ...profile.recent.map((r) => paint(S.dim, fit(r, rightW - 2))),
      ]
    : [];

  const title = ` ${A(`${profile.name}'s Portfolio`)} ${paint(S.dim, `v${profile.version}`)} `;
  const bar = A("│");
  const lines = [A("╭─") + title + A("─".repeat(Math.max(0, inner - 1 - vlen(title))) + "╮")];
  const rows = Math.max(left.length, wide ? right.length : 0);
  for (let i = 0; i < rows; i++) {
    const l = center(left[i] ?? "", leftW);
    lines.push(wide ? `${bar}${l}${bar} ${padEnd(right[i] ?? "", rightW - 1)}${bar}` : `${bar}${l}${bar}`);
  }
  lines.push(A(`╰${"─".repeat(inner)}╯`));
  return lines.map((l) => ` ${l}`);
}

function showWelcome() {
  const note = isHosted() ? `\n  ${paint(S.dim, profile.privacyNote ?? PRIVACY_NOTE)}` : "";
  out(`\n${banner().join("\n")}\n\n  ${paint(S.dim, profile.hint)}${note}\n\n`);
}

function menu() {
  const t = text();
  if (!t.startsWith("/") || t.includes(" ")) return [];
  return COMMANDS.filter((c) => c.name.startsWith(t.toLowerCase()));
}

function footer() {
  const items = menu();
  if (items.length) {
    state.sel = Math.min(state.sel, items.length - 1);
    const w = Math.max(...items.map((c) => c.name.length)) + 2;
    const room = cols() - 4;
    return items.map((c, i) => `  ${paint(i === state.sel ? S.accent : S.dim, fit(c.name.padEnd(w) + c.desc, room))}`);
  }
  if (state.help) {
    const rows = [
      ["/ for commands", "up/down for history"],
      ["esc to interrupt a reply", "ctrl+u to clear the line"],
      ["ctrl+c to clear or exit", "? to hide shortcuts"],
    ];
    return rows.map(([a, b]) => `  ${paint(S.dim, fit(a.padEnd(28) + b, cols() - 4))}`);
  }
  return [`  ${paint(S.dim, "? for shortcuts")}`];
}

function inputLines() {
  const w = cols();
  const rule = paint(S.rule, "─".repeat(w - 1));
  const room = Math.max(8, w - 3);
  const body = [];

  if (state.chars.length === 0) {
    const ph = [...fit(`Try "${state.hint}"`, room)];
    body.push(`${S.bold}>${S.reset} ${S.inverse}${ph[0]}${S.reset}${S.dim}${ph.slice(1).join("")}${S.reset}`);
  } else {
    const cells = [...state.chars, " "];
    for (let i = 0; i < cells.length; i += room) {
      const row = cells
        .slice(i, i + room)
        .map((ch, j) => (i + j === state.cur ? `${S.inverse}${ch}${S.reset}` : ch))
        .join("");
      body.push(`${i === 0 ? `${S.bold}>${S.reset} ` : "  "}${row}`);
    }
  }
  return [rule, ...body, rule, ...footer()];
}

function clearInputArea() {
  if (state.drawn > 1) out(`\x1b[${state.drawn - 1}A`);
  out("\r\x1b[J");
  state.drawn = 0;
}

function renderInput() {
  clearInputArea();
  const lines = inputLines();
  out(lines.join("\n"));
  state.drawn = lines.length;
}

function echo(line) {
  const room = cols() - 3;
  const chars = [...line];
  for (let i = 0; i < chars.length; i += room) {
    const chunk = chars.slice(i, i + room).join("");
    const lead = i === 0 ? `${S.dim}> ${S.reset}${S.band}` : "  ";
    out(`${S.band}${lead}${chunk}${" ".repeat(room - [...chunk].length)}${S.reset}\n`);
  }
}

function hook(lines) {
  lines.forEach((line, i) => out(`${i === 0 ? paint(S.dim, "  ⎿  ") : "     "}${line}\n`));
}

function showHelp() {
  const w = Math.max(...COMMANDS.map((c) => c.name.length)) + 2;
  hook(COMMANDS.map((c) => `${paint(S.accent, c.name.padEnd(w))}${paint(S.dim, c.desc)}`));
}

function showContact() {
  hook(
    profile.contact.map(([label, value]) => {
      const href = label === "Email" ? `mailto:${value}` : value;
      const display = value.replace(/^https?:\/\//, "");
      const clickable = `\x1b]8;;${href}\x1b\\${display}\x1b]8;;\x1b\\`;
      return `${paint(S.dim, label.padEnd(9))}${clickable}`;
    }),
  );
}

function showPrivacy() {
  if (!isHosted()) {
    hook([paint(S.dim, "Running with a local API key: this app stores nothing.")]);
    return;
  }
  hook(
    [
      "Logged: your questions, the answers, timing and your country.",
      "Not stored: your IP address, only a salted hash to spot abuse.",
      `Deleted automatically after ${profile.retentionDays ?? 90} days.`,
      "Opt out: set PORTFOLIO_PRIVATE=1 and only timing is recorded.",
      "Requests also pass through Cloudflare and Google as usual.",
    ].map((line) => paint(S.dim, line)),
  );
}

function clearScreen() {
  out("\x1b[2J\x1b[3J\x1b[H");
  state.messages = [];
  state.drawn = 0;
  showWelcome();
}

function quit() {
  clearInputArea();
  out(`${paint(S.dim, `Thanks for stopping by. Say hello at ${profile.contact[0][1]}.`)}\n`);
  process.stdin.setRawMode(false);
  process.exit(0);
}

function spin(start = Date.now()) {
  const verb = pick(VERBS);
  let i = 0;
  let live = true;
  const draw = () => {
    const secs = Math.floor((Date.now() - start) / 1000);
    const glyph = paint(S.accent, FRAMES[i++ % FRAMES.length]);
    const slow = secs >= 20 ? " · still waiting for the model" : "";
    out(`\r\x1b[2K${glyph} ${paint(S.accent, `${verb}…`)} ${paint(S.dim, `(${secs}s${slow} · esc to interrupt)`)}`);
  };
  draw();
  const timer = setInterval(draw, 120);
  return () => {
    if (!live) return;
    live = false;
    clearInterval(timer);
    out("\r\x1b[2K");
  };
}

function createWriter() {
  const limit = cols() - 1;
  let col = 0;
  let hang = 2;
  let first = true;
  let atStart = true;
  let lineHasText = false;
  let space = false;
  let newlines = 0;
  let word = "";
  let bold = false;
  let code = false;

  const style = () => (bold ? S.bold : "") + (code ? S.accent : "");

  const decorate = (raw) => {
    let styled = "";
    let len = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw.startsWith("**", i)) {
        bold = !bold;
        styled += S.reset + style();
        i++;
      } else if (raw[i] === "`") {
        code = !code;
        styled += S.reset + style();
      } else {
        styled += raw[i];
        len++;
      }
    }
    return { styled, len };
  };

  const flush = () => {
    if (!word) return;
    const raw = word;
    word = "";
    let { styled, len } = decorate(raw);
    if (len === 0) return;
    const bullet = atStart && (raw === "-" || raw === "*");
    let gap = space && lineHasText ? 1 : 0;
    if (lineHasText && col + gap + len > limit) {
      out("\n");
      col = 0;
      lineHasText = false;
      gap = 0;
    }
    if (col === 0) {
      out(first ? "● " : " ".repeat(hang));
      col = first ? 2 : hang;
      first = false;
    }
    if (bullet) {
      styled = "•";
      len = 1;
      hang = 4;
    }
    out((gap ? " " : "") + styled);
    col += gap + len;
    lineHasText = true;
    atStart = false;
    space = false;
    newlines = 0;
  };

  const lineBreak = () => {
    flush();
    newlines++;
    if (newlines === 1 && col > 0) out("\n");
    if (newlines === 2 && !first) out("\n");
    col = 0;
    lineHasText = false;
    atStart = true;
    hang = 2;
    space = false;
  };

  return {
    feed(chunk) {
      for (const ch of chunk) {
        if (ch === "\n") lineBreak();
        else if (ch === " " || ch === "\t") {
          flush();
          space = true;
        } else if (ch !== "\r") word += ch;
      }
    },
    end() {
      flush();
      out(S.reset);
      if (col > 0) {
        out("\n");
        col = 0;
      }
    },
  };
}

function friendly(err) {
  const detail = `${err.message} ${err.cause?.code ?? ""}`;
  if (/\(429\)/.test(detail)) return "The agent is getting a lot of questions right now. Try again in a minute.";
  if (/did not respond within/.test(detail)) return `${err.message} Try again, or run npm run ping to see where the time goes.`;
  if (/\(5\d\d\)/.test(detail)) return "The agent is temporarily unavailable. Try again shortly.";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(detail)) {
    return "Could not reach the agent. Check your connection and try again.";
  }
  return err.message;
}

function showTool(event) {
  const args = Object.entries(event.args ?? {})
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  const room = Math.max(10, cols() - event.name.length - 8);
  out(`${paint(S.accent, "●")} ${paint(S.bold, event.name)}${paint(S.dim, `(${fit(args, room)})`)}\n`);
  hook([paint(event.ok ? S.dim : S.error, `${event.summary} · ${event.ms} ms`)]);
}

async function ask(question) {
  out("\n");
  state.messages.push({ role: "user", content: question });
  const controller = new AbortController();
  state.abort = controller;
  const began = Date.now();
  let stop = spin(began);
  let writer = createWriter();
  let reply = "";
  try {
    for await (const event of streamReply(state.messages, controller.signal)) {
      stop();
      if (event.type === "tool") {
        writer.end();
        if (profile.showTools !== false) showTool(event);
        writer = createWriter();
        stop = spin(began);
        continue;
      }
      reply += event.text;
      writer.feed(event.text);
    }
    stop();
    writer.end();
    if (!reply.trim()) throw new Error("The agent returned an empty reply.");
    state.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    stop();
    writer.end();
    state.messages.pop();
    const stopped = controller.signal.aborted;
    hook([paint(stopped ? S.dim : S.error, stopped ? "Interrupted" : friendly(err))]);
  } finally {
    state.abort = null;
  }
}

async function submit() {
  state.busy = true;
  try {
    const items = menu();
    let line = text().trim();
    if (items.length && !items.some((c) => c.name === line.toLowerCase())) line = items[state.sel].name;
    state.history.push(line);
    state.hi = -1;
    state.chars = [];
    state.cur = 0;
    state.help = false;
    clearInputArea();
    echo(line);

    if (line.startsWith("/")) {
      const cmd = COMMANDS.find((c) => c.name === line.toLowerCase());
      if (!cmd) hook([paint(S.dim, `Unknown command ${line.split(" ")[0]}. Type /help to list commands.`)]);
      else if (cmd.run) await cmd.run();
      else await ask(cmd.ask);
    } else {
      await ask(line);
    }
  } finally {
    state.busy = false;
    state.hint = pick(profile.examples);
    out("\n");
    renderInput();
  }
}

function insert(str) {
  const add = [...str];
  state.chars.splice(state.cur, 0, ...add);
  state.cur += add.length;
  state.sel = 0;
}

function deleteWord() {
  let i = state.cur;
  while (i > 0 && state.chars[i - 1] === " ") i--;
  while (i > 0 && state.chars[i - 1] !== " ") i--;
  state.chars.splice(i, state.cur - i);
  state.cur = i;
  state.sel = 0;
}

function move(dir) {
  const items = menu();
  if (items.length) {
    state.sel = (state.sel + dir + items.length) % items.length;
    return;
  }
  const h = state.history;
  if (state.hi === -1) state.hi = h.length;
  if (state.hi === h.length) state.draft = state.chars;
  state.hi = Math.min(h.length, Math.max(0, state.hi + dir));
  state.chars = state.hi === h.length ? state.draft : [...h[state.hi]];
  state.cur = state.chars.length;
}

function complete() {
  const items = menu();
  if (!items.length) return;
  state.chars = [...items[state.sel].name];
  state.cur = state.chars.length;
}

function onKey(k) {
  if (k === "\x1b[200~" || k === "\x1b[201~") {
    state.paste = k === "\x1b[200~";
    return;
  }
  if (state.busy) {
    if (k === "\x1b" || k === "\x03") state.abort?.abort();
    return;
  }
  const n = state.chars.length;
  switch (k) {
    case "\x03":
      if (n) {
        state.chars = [];
        state.cur = 0;
      } else quit();
      break;
    case "\x04":
      if (!n) quit();
      break;
    case "\r":
    case "\n":
    case "\r\n":
      if (state.paste) insert(" ");
      else if (text().trim()) submit();
      break;
    case "\x7f":
    case "\b":
      if (state.cur > 0) state.chars.splice(--state.cur, 1);
      state.sel = 0;
      break;
    case "\x1b[3~":
      state.chars.splice(state.cur, 1);
      state.sel = 0;
      break;
    case "\x1b[D":
    case "\x02":
      state.cur = Math.max(0, state.cur - 1);
      break;
    case "\x1b[C":
    case "\x06":
      state.cur = Math.min(n, state.cur + 1);
      break;
    case "\x1b[H":
    case "\x1bOH":
    case "\x01":
      state.cur = 0;
      break;
    case "\x1b[F":
    case "\x1bOF":
    case "\x05":
      state.cur = n;
      break;
    case "\x15":
      state.chars.splice(0, state.cur);
      state.cur = 0;
      break;
    case "\x0b":
      state.chars.splice(state.cur);
      break;
    case "\x17":
      deleteWord();
      break;
    case "\x1b[A":
      move(-1);
      break;
    case "\x1b[B":
      move(1);
      break;
    case "\t":
      complete();
      break;
    case "\x1b":
      state.help = false;
      break;
    default:
      if (k === "?" && n === 0) state.help = !state.help;
      else if (k >= " " && !k.startsWith("\x1b")) {
        insert(k);
        state.help = false;
      }
  }
}

function start() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(`${profile.name}'s portfolio needs an interactive terminal.`);
    process.exit(1);
  }
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  process.stdin.on("data", (chunk) => {
    for (const k of chunk.match(KEY) ?? []) onKey(k);
    if (!state.busy) renderInput();
  });
  process.stdout.on("resize", () => {
    if (!state.busy) renderInput();
  });
  process.on("exit", () => out("\x1b[?2004l\x1b[?25h"));
  out(`\x1b]0;${profile.name}'s Portfolio\x07\x1b[?2004h\x1b[?25l`);
  showWelcome();
  renderInput();
}

start();
