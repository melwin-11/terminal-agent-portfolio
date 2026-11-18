# Melwin's Terminal Portfolio Agent

A terminal portfolio agent that answers questions about Melwin Robinson's experience, projects, research, skills, and public links. It uses Gemini for responses and can run locally or through a Cloudflare Worker. LangSmith tracing is configured for the hosted agent.

## Requirements

- Node.js 18 or newer
- A Gemini API key for local model calls, or access to the configured hosted Worker
- Wrangler authentication and the configured Cloudflare resources for deployment

## Install and run

```sh
npm install
npm start
```

The CLI defaults to the hosted transport. To run the agent locally, set `PORTFOLIO_TRANSPORT=local` and `GEMINI_API_KEY`; local mode also needs the private `knowledge/knowledge.js` file. `PORTFOLIO_TRANSPORT=hosted` explicitly selects the Worker endpoint. See `src/profile.js` for the transport and endpoint defaults.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the terminal agent |
| `npm run ping` | Check that a configured Gemini API key can reach the model API |
| `npm run trace` | Inspect locally recorded traces |
| `npm run report` | Summarize local trace data |
| `npm run deploy` | Deploy the Cloudflare Worker |
| `npm run db:init` | Initialize the configured remote D1 trace database |

## Project layout

- `src/` — terminal interface, transport selection, Gemini provider, fallback policy, and local LangSmith integration
- `core/` — agent loop, profile persona, knowledge-backed tools, and trace handling
- `worker/` — Cloudflare Worker API and trace storage/export
- `scripts/` — API ping and local trace utilities
- `knowledge/knowledge.js` — private profile knowledge; intentionally excluded from Git

## Private profile knowledge

`knowledge/knowledge.js` contains personal profile data and is ignored by Git. Do not force-add it. A fresh clone does not contain this file, and the Worker bundle currently imports it, so a local deployment checkout needs Melwin's private copy at that exact path before building or deploying. Keep it in a secure backup; it is not recoverable from the public repository.

## Deployment

See [docs/deployment.md](docs/deployment.md) for staged Cloudflare deployment, secrets, LangSmith, and verification steps. Never put API keys in source files or commit `.env` / `.dev.vars` files.

## License

MIT. See [LICENSE](LICENSE).
