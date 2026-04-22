# Drips Issues Reviewer

An internal tool for [Drips Wave](https://www.drips.network/) program organizers and maintainers. Paste a GitHub repository URL and the app scores every open issue against the 5 Drips principles — expressed as 8 deterministic checks — then lets a QA agent (Vera) draft and post actionable feedback directly on GitHub.

## What it does

- Fetches open issues from any public GitHub repo.
- Scores each issue across **8 rubric checks** (title specificity, body length, file paths, scope, setup steps, acceptance criteria, labels, milestone).
- Assigns a grade **A / B / C / D** based on the 16-point total.
- Suggests a Drips complexity tier (**Trivial 100 / Medium 150 / High 200 pts**).
- For C and D issues, generates a ready-to-post Vera comment with specific fixes.

Full methodology: [`docs/scoring-methodology.md`](./docs/scoring-methodology.md).

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript 5
- Tailwind CSS 4
- GitHub OAuth for authenticated issue fetching and comment posting
- [Vera API](https://github.com/stepandel/vera-api) as the AI agent runtime — this app never talks to Anthropic directly; all LLM calls are proxied through a local Vera instance via `POST /api/vera/feedback`

## Getting started

```bash
git clone https://github.com/mmazco/drips-issues-reviewer.git
cd drips-issues-reviewer
npm install
cp .env.local.example .env.local   # then fill in your values
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

Create `.env.local` with:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID (create at github.com/settings/developers → OAuth Apps). |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `NEXT_PUBLIC_BASE_URL` | Base URL used in OAuth callbacks. Local dev: `http://localhost:3000`. Production: your Railway domain. |
| `VERA_API_URL` | Base URL of your running Vera instance. Local dev: `http://localhost:3010`. |
| `VERA_API_TOKEN` | Optional bearer token. Must match the `VERA_API_TOKEN` set on the Vera side. |

OAuth callback URL to register on GitHub: `{NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`.

Note: the Anthropic API key lives **only on the Vera host** (as `ANTHROPIC_API_KEY` for `bun run serve`). This app never reads it and never exposes it to the browser.

## Running Vera locally

This app expects a Vera instance on `VERA_API_URL`. Vera is a **separate project** — clone it as a sibling directory (do not nest it inside this repo):

```bash
# From a folder alongside this repo (e.g. ~/Cursor):
git clone https://github.com/stepandel/vera-api.git
cd vera-api
bun install
gh auth login                          # so Vera can post GitHub comments on your behalf
mkdir -p .vera/skills/drips-qa-feedback
# Copy the skill template from this repo (adjust the relative path to wherever
# your drips-issues-reviewer clone lives):
cp /path/to/drips-issues-reviewer/docs/vera-skills/drips-qa-feedback/SKILL.md .vera/skills/drips-qa-feedback/
ANTHROPIC_API_KEY=sk-ant-... VERA_API_TOKEN=some-shared-secret PORT=3010 bun run serve
```

Then in this repo's `.env.local`, set `VERA_API_URL=http://localhost:3010` and `VERA_API_TOKEN=some-shared-secret` (same value as above).

Run the two services in separate terminals: `npm run dev` here on `:3000`, and `bun run serve` in `vera-api/` on `:3010`. Vera does **not** need access to this repo — it only needs its own source, `gh` auth, and an Anthropic key.

## Scripts

```bash
npm run dev      # start dev server on http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Deployment (Railway)

This project deploys on [Railway](https://railway.app/).

1. Create a new Railway service pointed at this repo — Railway auto-detects the Next.js app and runs `npm run build` + `npm run start`.
2. In **Variables**, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_BASE_URL` (your Railway public domain, e.g. `https://drips-issues-reviewer.up.railway.app`), plus `VERA_API_URL` and `VERA_API_TOKEN` pointing at your deployed Vera service.
3. Update the GitHub OAuth app callback URL to `{NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`.
4. Deploy.

## Project layout

```
app/                  # App Router pages + API routes
  page.tsx            # Landing: paste repo URL, see scores inline
  review/             # Full per-issue review + Vera draft + post flow
  history/            # Review history
  wave/               # Wave tracker
  guide/              # In-app scoring guide
  api/auth/github/    # OAuth start + callback + logout
  api/vera/feedback/  # Server proxy → Vera /api/agent/turn (holds VERA_API_TOKEN)
components/           # Nav, RubricGuide
lib/
  scoring.ts          # Deterministic 8-check rubric + grade + complexity suggestion
  github.ts           # GitHub REST helpers
  teams.ts            # Wave team state
  useGitHubAuth.ts    # Client-side auth hook
docs/
  scoring-methodology.md      # Full rubric + grade thresholds
  seyf-app-main-feedback.md   # Example output: Seyfert-Labs/seyf-app-main
  vera-skills/
    drips-qa-feedback/SKILL.md  # Copy into vera-api/.vera/skills/
```

## References

- [Drips: Creating Meaningful Issues (blog)](https://www.drips.network/blog/posts/creating-meaningful-issues)
- [Drips: Participating in a Wave (docs)](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)
