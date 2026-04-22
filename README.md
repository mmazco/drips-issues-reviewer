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
- Optional Anthropic API for LLM-assisted Vera drafts

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
| `NEXT_PUBLIC_ANTHROPIC_KEY` | Optional. Enables LLM-assisted Vera drafts on the review page. |

OAuth callback URL to register on GitHub: `{NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`.

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
2. In **Variables**, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_BASE_URL` (your Railway public domain, e.g. `https://drips-issues-reviewer.up.railway.app`), and optionally `NEXT_PUBLIC_ANTHROPIC_KEY`.
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
components/           # Nav, RubricGuide
lib/
  scoring.ts          # Deterministic 8-check rubric + grade + complexity suggestion
  github.ts           # GitHub REST helpers
  teams.ts            # Wave team state
  useGitHubAuth.ts    # Client-side auth hook
docs/
  scoring-methodology.md      # Full rubric + grade thresholds
  seyf-app-main-feedback.md   # Example output: Seyfert-Labs/seyf-app-main
```

## References

- [Drips: Creating Meaningful Issues (blog)](https://www.drips.network/blog/posts/creating-meaningful-issues)
- [Drips: Participating in a Wave (docs)](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)
