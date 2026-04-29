# Drips Issues Reviewer

An internal tool for [Drips Wave](https://www.drips.network/) program organizers and maintainers. Paste a GitHub repository URL and the app scores every open issue against the 5 Drips principles — expressed as 8 deterministic checks — then lets the QA agent (Vera) draft and post actionable feedback directly on GitHub.

> **Vera** is the brand of the QA agent. The implementation is direct calls to Anthropic Claude (Opus 4.7 by default) — no separate agent runtime to host. See [`docs/vera-skills/drips-qa-feedback/SKILL.md`](./docs/vera-skills/drips-qa-feedback/SKILL.md) for the agent spec.

## What it does

- Fetches open issues from any public GitHub repo.
- Scores each issue across **8 rubric checks** (title specificity, body length, file paths, scope, setup steps, acceptance criteria, labels, milestone).
- Assigns a grade **A / B / C / D** based on the 16-point total.
- Suggests a Drips complexity tier (**Trivial 100 / Medium 150 / High 200 pts**).
- For C and D issues, generates a ready-to-post Vera comment with specific fixes.
- Beyond per-issue scoring, can run a **docs review** or **setup review** on the whole repo and draft a new GitHub issue if quality gaps are found.

Full methodology: [`docs/scoring-methodology.md`](./docs/scoring-methodology.md).

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript 5
- Tailwind CSS 4
- GitHub OAuth for authenticated issue fetching, comment posting, and issue creation
- Anthropic Claude Opus 4.7 called directly server-side (`@anthropic-ai/sdk`); the system prompts that condition the model live in [`lib/prompts.ts`](./lib/prompts.ts)

## Getting started

```bash
git clone https://github.com/mmazco/drips-issues-reviewer.git
cd drips-issues-reviewer
npm install
# Then create .env.local with the variables below
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

Create `.env.local` with:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | yes | GitHub OAuth app client ID (create at [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps). |
| `GITHUB_CLIENT_SECRET` | yes | GitHub OAuth app client secret. |
| `NEXT_PUBLIC_BASE_URL` | yes | Base URL used in OAuth callbacks. Local: `http://localhost:3000`. Production: your Railway domain. |
| `ANTHROPIC_API_KEY` | yes | Anthropic API key (starts `sk-ant-`). Get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys). |
| `ANTHROPIC_MODEL` | no | Override the default Claude model. Defaults to `claude-opus-4-7`. Sonnet is ~10× cheaper if you want to trade quality for cost. |

OAuth callback URL to register on GitHub: `{NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`.

The Anthropic key is used **only server-side** in `lib/anthropic.ts` and is never exposed to the browser.

## Scripts

```bash
npm run dev      # start dev server on http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Deployment (Railway)

This project deploys on [Railway](https://railway.app/) as a single service.

1. Create a new Railway service pointed at this repo. Railway auto-detects Next.js and runs `npm run build` + `npm run start`.
2. In **Variables**, set all five env vars from the table above. Use your Railway public domain (e.g. `https://drips-issues-reviewer.up.railway.app`) for `NEXT_PUBLIC_BASE_URL`.
3. Update the GitHub OAuth app callback URL to `{NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`.
4. Deploy.

No second service needed — Anthropic is called directly from the Next.js routes.

## Project layout

```
app/                          # App Router pages + API routes
  page.tsx                    # Landing: paste repo URL, see scores inline
  review/                     # Full per-issue review + Vera draft + post flow
  history/                    # Review history
  wave/                       # Wave tracker
  guide/                      # In-app scoring guide
  api/auth/github/            # OAuth start + callback + logout
  api/vera/feedback/          # Issue review route → Anthropic
  api/vera/repo-check/        # Docs / setup review route → Anthropic
components/                   # Nav, RubricGuide
lib/
  scoring.ts                  # Deterministic 8-check rubric + grade + complexity suggestion
  github.ts                   # GitHub REST helpers (fetch, post comment, create issue, fetch repo files)
  anthropic.ts                # Anthropic client + runAgent() helper + JSON extractor
  prompts.ts                  # System prompts for the three agent modes (issue / docs / setup)
  teams.ts                    # Wave team state
  useGitHubAuth.ts            # Client-side auth hook
docs/
  scoring-methodology.md      # Full rubric + grade thresholds
  seyf-app-main-feedback.md   # Example output: Seyfert-Labs/seyf-app-main
  vera-skills/
    drips-qa-feedback/SKILL.md  # Vera agent behavior spec (mirrors lib/prompts.ts)
```

## References

- [Drips: Creating Meaningful Issues (blog)](https://www.drips.network/blog/posts/creating-meaningful-issues)
- [Drips: Participating in a Wave (docs)](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
