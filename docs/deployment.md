# Deployment and operations

This project has a terminal client and a Cloudflare Worker backend. Deploy changes gradually and verify the live agent after each backend update.

## 1. Prepare a private-capable checkout

Install dependencies with `npm install`. Restore Melwin's private `knowledge/knowledge.js` into `knowledge/` from a secure local backup. The file is deliberately ignored by Git but is imported by the Worker and local agent, so a clean clone cannot bundle the agent until the private file is restored.

## 2. Configure Cloudflare

Authenticate Wrangler with `npx wrangler login`. Check `wrangler.toml` for the Worker name, D1 database, rate limit binding, and non-secret LangSmith settings. Configure the required credentials as Cloudflare Worker secrets; do not commit credentials:

```sh
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put LANGSMITH_API_KEY
```

The Worker reads `LANGSMITH_ENDPOINT`, `LANGSMITH_AGENT_ID`, and `LANGSMITH_AGENT_ENVIRONMENT` from `wrangler.toml`. Hosted tracing is enabled when `LANGSMITH_API_KEY` is present; the Worker does not require a separate `LANGSMITH_TRACING` variable. For the local CLI, tracing runs when `LANGSMITH_API_KEY` is present and is disabled only when `LANGSMITH_TRACING=false`. Keep the LangSmith project aligned with the intended environment.

## 3. Initialize storage and deploy

If provisioning a new D1 database, update its binding in `wrangler.toml`, then run:

```sh
npm run db:init
npm run deploy
```

The D1 initialization command targets the remote database. Skip it when the existing database is already initialized.

## 4. Verify in small steps

1. Check the Worker's `/health` endpoint and confirm it returns `{"ok":true}`.
2. Start the terminal client and ask a few questions whose answers exist in the private profile knowledge.
3. Check Cloudflare logs for request errors and LangSmith for new traces.
4. Try a question that should use a profile tool, such as asking about projects or experience.
5. After changing profile facts, restore/edit the local private knowledge file, redeploy, and ask about the new fact.

Use `npm run ping` to check direct Gemini API connectivity independently of the hosted agent. It does not verify Worker deployment or LangSmith tracing.

Run `npm test` for the deterministic topic and prompt-injection policy checks before deploying.

## Request-limit behavior

`wrangler.toml` configures the Worker Rate Limiting binding for 8 requests per IP per 60 seconds. Cloudflare's Worker rate-limit binding is approximate and can allow bursts over the configured threshold; it is not a hard spend cap. The 300-per-day cap reads today's D1 trace count before calling Gemini, so it is also a soft cap under concurrent requests or D1 failures. Review Cloudflare logs and billing if usage needs a strict ceiling. A strict global limit would need a coordinated counter such as a Durable Object, which adds operational cost and should be chosen deliberately.

Malformed requests are rejected before model invocation and do not create traces. When smoke-testing rate limits, use invalid request bodies, inspect HTTP statuses, and remember that one burst may not reliably produce a 429 because the binding is approximate.

## GitHub and deployment boundary

The public Git repository intentionally omits `knowledge/knowledge.js` and local secrets. Do not use `git add -f` on ignored personal data. For local deployments, keep the private file in the working tree. For future GitHub Actions deployments, inject the file from a suitably protected secret or private artifact at build time; never commit it to the public repository.
