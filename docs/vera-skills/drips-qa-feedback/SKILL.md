# drips-qa-feedback skill

Copy this file into your local `vera-api` clone at:

```
vera-api/.vera/skills/drips-qa-feedback/SKILL.md
```

Vera auto-loads anything under `.vera/skills/`. Restart `bun run serve` after adding it.

---

## Purpose

Review a single GitHub issue against the Drips Wave rubric and return a strict JSON verdict (plus an optional markdown comment draft). The `drips-issues-reviewer` Next.js app calls `POST /api/agent/turn` with a precomputed scorecard embedded in `message`; this skill tells Vera how to respond.

Optionally, the skill can also **post the QA comment** to GitHub using the `gh` CLI (requires `gh auth login` on the Vera host).

## When to activate

Activate when the user's message:

- References a GitHub issue URL (`github.com/<owner>/<repo>/issues/<n>`) **and**
- Includes a "Deterministic scorecard" section, **and**
- Asks you to respond with strict JSON.

This matches the prompt sent by the Next.js app's `/api/vera/feedback` route.

## What to do

1. Read the scorecard and the issue body from the message — **do not re-fetch** the issue unless the body is marked `(empty body)`. The score and per-check statuses are ground truth.
2. For each failed or warned check, produce a concrete, actionable suggestion. Reference the issue's language and domain (don't say "add file paths" — say "reference `src/features/wallet/WalletConnect.tsx`" if that's what's relevant).
3. Decide a verdict:
   - `ready` — score ≥ 65% and no fails on `title`, `context`, or `acceptance`.
   - `needs-work` — score 45–64% or one structural fail.
   - `reject` — score < 45% or the issue is off-scope (wrong repo, dupe, spam).
4. Recommend a complexity tier (`Trivial` / `Medium` / `High`) using Drips' definitions:
   - **Trivial (100 pts)** — single file, docs, copy, rename, typo.
   - **Medium (150 pts)** — single feature, 1–3 files, well-scoped.
   - **High (200 pts)** — cross-cutting, multi-file, new integrations, migrations.
   - If the deterministic `suggestedComplexity` already matches, echo it back and explain why in one sentence.
5. If the verdict is `needs-work` or `reject`, draft a short markdown comment (≤ 12 lines, no headers deeper than `###`, no emoji) that a maintainer could paste verbatim. Put it in `comment_draft`.

## Response contract

Respond with **JSON only** (no code fences, no commentary). Shape:

```json
{
  "verdict": "ready" | "needs-work" | "reject",
  "suggested_complexity": "Trivial" | "Medium" | "High",
  "complexity_reasoning": "one sentence",
  "rewritten_title": "better title or null",
  "missing": ["up to 5 short bullets"],
  "scope_concern": "string or null",
  "suggestions": "2-3 concrete fixes as a short paragraph",
  "comment_draft": "optional markdown QA comment"
}
```

The Next.js proxy at `app/api/vera/feedback/route.ts` parses this via `JSON.parse` and falls back to a deterministic rubric review if parsing fails — so strict JSON matters.

## Posting to GitHub (optional)

If the user's message explicitly asks you to post the comment (e.g. "post the QA feedback"), use the `bash` tool to run:

```
gh issue comment <issue-url> --body-file -
```

Pipe the `comment_draft` contents into stdin. Do **not** post unless explicitly asked — the Next.js app also supports posting via the user's OAuth token, which is the default.

## Non-goals

- Don't open PRs, edit files in the target repo, or make GraphQL mutations beyond `issue comment`.
- Don't re-score the issue — the 8-check rubric is deterministic and lives in the Next.js app's `lib/scoring.ts`. You're adding qualitative judgment on top.
- Don't hallucinate labels or milestones that aren't in the scorecard.
