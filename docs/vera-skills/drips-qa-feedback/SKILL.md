# Vera agent — how it actually works

> "Vera" is the brand of the QA agent users see in the UI. The implementation is direct calls to Anthropic Claude (Opus 4.7 by default) — there is no separate Vera service to run.

This document is the human-readable spec for the agent's behavior. The actual prompts shipped to Anthropic at runtime live in [`lib/prompts.ts`](../../../lib/prompts.ts). **If you change behavior, change both** — this doc is the source of truth for "what should the agent do?"; `lib/prompts.ts` is what the model actually receives.

## What "skills" mean in this app

Anthropic's Messages API doesn't have a built-in "skill" concept — a skill is just a carefully crafted **system prompt** that tells the model:

1. The role it's playing (e.g. "you are the drips-qa-feedback agent in DOCS REVIEW mode").
2. The shared rules it must always follow (no agent name in maintainer-facing output, exact opening/closing copy, response format).
3. The mode-specific instructions (what to evaluate, what verdict scale to use).
4. The strict JSON shape it must return (so the calling route can `JSON.parse` the response).

We split one logical "agent" into three modes — each gets its own system prompt and is invoked by a different API route.

```
Browser → Next.js route → Anthropic API
              ↓
     system prompt = relevant skill from lib/prompts.ts
     user message  = scorecard + issue body / fetched docs / fetched README
```

The system prompt is the agent's behavior. The user message is the data being reviewed. Anthropic returns strict JSON; the route parses it and hands it back to the UI. No filesystem access, no MCP, no tools — pure messages.

## The three modes

### 1. Issue review

- **Triggered by:** `POST /api/vera/feedback`
- **System prompt:** `ISSUE_REVIEW_SYSTEM` in `lib/prompts.ts`
- **User message contains:** the issue title + body + the deterministic scorecard already computed by `lib/scoring.ts` (an 8-check rubric the agent must NOT re-score).
- **Verdicts:** `ready` / `needs-work` / `reject`
- **Output includes:** a `comment_draft` markdown body the reviewer can post as a comment on the existing issue.

### 2. Docs review

- **Triggered by:** `POST /api/vera/repo-check` with `mode: "docs"`
- **System prompt:** `DOCS_REVIEW_SYSTEM` in `lib/prompts.ts`
- **User message contains:** the contents of the repo's README, CONTRIBUTING, and a few `docs/*.md` files (fetched server-side by `lib/github.ts → fetchDocFiles`).
- **Verdicts:** `good` / `needs-work` / `broken`
- **Output includes:** an `issue_title` + `issue_body` for opening a NEW issue on the repo (not a comment), if anything is wrong.

### 3. Setup review

- **Triggered by:** `POST /api/vera/repo-check` with `mode: "setup"`
- **System prompt:** `SETUP_REVIEW_SYSTEM` in `lib/prompts.ts`
- **User message contains:** the README and CONTRIBUTING only (focused, no `docs/`).
- **Single question being answered:** can a new contributor clone this repo and get it running locally in 5 minutes?
- **Same verdict scale and output shape as docs review.**

## Shared rules (apply to every mode)

These rules are baked into all three system prompts so the model can't accidentally violate them:

1. **Strict JSON only** — no prose outside the JSON, no markdown code fences. The calling route does `JSON.parse(response)` and falls back to a deterministic template if parsing fails.
2. **No agent name in maintainer-facing output.** The `comment_draft` / `issue_body` is read by the repo author. The model is forbidden from saying "Vera", "AI", "Claude", "agent", or "drafted with". The GitHub author avatar already makes the reviewer obvious.
3. **Exact opening line:**
   - Issue mode: `Hi from the Drips team — quick QA review for Wave readiness.`
   - Docs mode: `Hi from the Drips team — quick documentation review for Wave readiness.`
   - Setup mode: `Hi from the Drips team — quick setup review for Wave readiness.`
4. **Exact closing block:**
   ```
   ---
   *Want help reshaping this? Reply here or ping us in the Drips Discord.*
   ```
5. **Optional reviewer signature** — if the user message includes a `Reviewer: @username` line, the model appends `*— Reviewed by @username*` after the closing.

## Why this approach (instead of an open-ended chat)

Three reasons, in order of importance:

- **Predictability.** A constrained system prompt + strict JSON output means the UI can always render results — no need to handle free-form prose. Maintainers always get a comment in the same shape.
- **Brand safety.** The opening/closing copy is pinned. The model can't invent a different voice or accidentally disclose that the comment was AI-assisted.
- **Cost control.** No multi-turn conversations means no growing context window — every call is a single round-trip.

## Where to change behavior

| To change... | Edit this file |
|---|---|
| What the agent evaluates / how it grades | `lib/prompts.ts` (the relevant `*_SYSTEM` constant) and update this doc |
| The deterministic 8-check rubric | `lib/scoring.ts` (and update `docs/scoring-methodology.md`) |
| What data gets sent to the model | The route handler (`buildUserMessage` / `buildDocsUserMessage` / `buildSetupUserMessage`) |
| The model used | `ANTHROPIC_MODEL` in `.env.local` (default: `claude-opus-4-7`) |
| The opening/closing copy maintainers see | The shared rules block in `lib/prompts.ts` (and update this doc) |

## Non-goals

- The agent does NOT re-score issues. The 8-check rubric is deterministic in `lib/scoring.ts` — Anthropic only adds qualitative judgment on top.
- The agent does NOT open PRs or modify code in the target repo. The only writes it triggers (via the user clicking "Post to GitHub" / "Open issue on GitHub") are creating an issue or posting a comment, both via the user's OAuth token.
- The agent does NOT have tool-use enabled. No bash, no file access, no internet — just structured JSON output from the data we hand it.
