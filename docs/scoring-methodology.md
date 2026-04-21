# Drips Wave Issue Quality Scoring — Methodology

## What Drips provides

Drips publishes qualitative guidance for maintainers through the ["Creating Meaningful Issues"](https://www.drips.network/blog/posts/creating-meaningful-issues) blog post, the Wave maintainer onboarding slides, and the [maintainer docs](https://docs.drips.network/wave/maintainers/participating-in-a-wave/). The guidance is organized around **5 principles** and a **3-tier complexity system**. Drips does **not** provide a quantitative scoring system — they describe what good looks like but don't measure it numerically.

## What we built

We operationalized the 5 qualitative principles into **8 automated checks** that run against any GitHub issue body. This produces a repeatable, measurable score that lets us compare issue quality across repos and track improvement over time.

---

## The 5 Drips Principles

1. **Real Impact** — Does this issue meaningfully improve the product? If the answer is "meh," rethink it. Waves move fast — you want issues that create momentum, not noise.
2. **Clear Context** — Give contributors the why, not just the what. Share the background, the problem, and what "done" should look like. Context helps contributors make better decisions without constantly asking for clarification.
3. **Scoped for One Wave** — Issues should be completable within a single 7-day Wave cycle. Too big = overwhelming. Too small = pointless. If it's large, break it into smaller related issues.
4. **Implementation Guidelines** — Point contributors toward key files or modules, design references, edge cases, constraints, and how you want the change validated. Offer direction, not handcuffs.
5. **Explicit Expectations** — Contributors shouldn't have to guess what you expect. Be clear about what "done" looks like, how you'll review the work, and what must be included in the PR.

---

## The 8 Automated Checks

Each check maps to one or more Drips principles and scores **Pass (2 pts)**, **Warn (1 pt)**, or **Fail (0 pts)**. The maximum score is **16 points**.


| #   | Check                       | Drips Principle            | Pass (2 pts)                                           | Warn (1 pt)                               | Fail (0 pts)                                                             |
| --- | --------------------------- | -------------------------- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Title specificity           | 1. Real Impact             | 5+ word descriptive title                              | 3–4 words                                 | Vague ("fix bug", "update") or <3 words                                  |
| 2   | Body length                 | 2. Clear Context           | 200+ characters                                        | Under 200 characters                      | Empty body                                                               |
| 3   | File paths referenced       | 2. Context + 4. Guidelines | 2+ file/module refs in body                            | 1 file reference                          | No file paths mentioned                                                  |
| 4   | Scope (area label stacking) | 3. Scoped for Wave         | 1 area label                                           | 2 area labels                             | 3+ area labels stacked (e.g. frontend + smart-contract + infrastructure) |
| 5   | Setup / validation steps    | 4. Guidelines              | Code blocks or shell commands present                  | —                                         | No setup or validation instructions                                      |
| 6   | Acceptance criteria         | 5. Expectations            | Explicit criteria, checkboxes, or "definition of done" | Implicit goal language ("should", "must") | No acceptance criteria                                                   |
| 7   | Labels applied              | Hygiene                    | 2+ labels                                              | 1 label                                   | No labels                                                                |
| 8   | Milestone attached          | Hygiene                    | Attached to a milestone                                | —                                         | No milestone (warn only)                                                 |


> Note: checks 4 and 8 only have two outcomes (Pass/Fail or Pass/Warn). The 16-point max still applies; those checks simply contribute 0 or 2 pts (check 4) or 1 or 2 pts (check 8) in practice.

---

## Grade Thresholds

The 16-point max is converted to a percentage, then mapped to a letter grade:


| Grade | Score            | Meaning                              |
| ----- | ---------------- | ------------------------------------ |
| **A** | ≥80% (13+ pts)   | Wave-ready — minor fixes at most     |
| **B** | ≥65% (11–12 pts) | Close — needs a few improvements     |
| **C** | ≥45% (8–10 pts)  | Needs work — multiple checks failing |
| **D** | <45% (0–7 pts)   | Not ready — fundamental gaps         |


**Note:** These grade thresholds are our inference based on reviewing real Wave repos. They are not defined by Drips. The cutoffs were calibrated by reviewing MañanaSeguro (mostly A/B results) and Bimex (mostly C/D results) and checking that the grades matched our qualitative assessment.

---

## Drips Complexity & Points System

This part **is** defined by Drips and is set by the maintainer in the Drips Wave dashboard when adding an issue:


| Complexity  | Base Points | Complexity Bonus | Total       | Use for                                                                             |
| ----------- | ----------- | ---------------- | ----------- | ----------------------------------------------------------------------------------- |
| **Trivial** | 100         | —                | **100 pts** | Small, clearly bounded changes — typos, copy fixes, minor bug fixes, README updates |
| **Medium**  | 100         | +50              | **150 pts** | Standard features, bugs touching multiple parts of the codebase                     |
| **High**    | 100         | +100             | **200 pts** | Complex integrations, refactors, architectural changes                              |


**How points become money:** At the end of each Wave cycle, the total reward pool (e.g. $60,000 for Stellar Waves) is split proportionally among all contributors based on their share of total points earned. So if a contributor earned 300 points out of 10,000 total points across all contributors, they receive 3% of the pool.

Our tool **suggests** a complexity tier for each issue based on heuristics (title/body keywords, scope labels), but the maintainer makes the final decision in the Drips dashboard.

---

## How the QA Agent (Vera) Layer Works

Issues graded **C or D** are flagged for a QA comment. The comment includes:

- Which checks failed and what specifically to fix
- Which checks are in warn state and could improve
- The suggested complexity tier
- A link to the Drips ["Creating Meaningful Issues"](https://www.drips.network/blog/posts/creating-meaningful-issues) guide

Issues graded **A or B** pass without a comment — no action needed from the maintainer.

---

## What's Automated vs. What Requires Human Judgment


| Automated (tool handles)           | Human judgment (BD / maintainer)                    |
| ---------------------------------- | --------------------------------------------------- |
| 8 rubric checks against issue body | Whether the issue has "real impact" on the project  |
| Grade calculation                  | Whether the scope is truly achievable in 7 days     |
| Suggested complexity tier          | Final complexity tier assignment in Drips dashboard |
| Vera comment generation            | Whether to split an oversized issue vs. keep it     |
| Review history tracking            | Approving/rejecting contributor applications        |


---

## References

- [Drips: Creating Meaningful Issues (blog)](https://www.drips.network/blog/posts/creating-meaningful-issues)
- [Drips: Participating in a Wave (docs)](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)

