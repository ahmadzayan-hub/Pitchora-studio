# Pitchora repository guidance

Read [product authority](docs/PRODUCT_AUTHORITY.md), the
[repository guide](docs/REPOSITORY_GUIDE.md) and
[design guide](docs/DESIGN_GUIDE.md) before UI work. Preserve their existing
product, data, security and release boundaries. This guidance does not authorize
deployment, source uploads, purchases, dependency installation or unrelated work.

For a specifically requested motion review, use
[review-animations](.agents/skills/review-animations/SKILL.md).
For specifically requested interface polish, use
[emil-design-eng](.agents/skills/emil-design-eng/SKILL.md).
These are optional, explicitly selected project-scoped adapters, not global
account skills. Do not load both by default or apply either to backend-only work.
Preserve any separately installed UI/UX Pro Max or other user skills; this
repository does not overwrite them.

Run `python3 scripts/test-design-skills.py` for guidance/provenance changes.
For application changes, use the existing typecheck, lint, test and build gates
in the repository guide and any affected browser/export acceptance tests.
Never describe source-only guidance as a shipped interface improvement.

## Evidence and credibility

Apply this guidance within higher-priority instructions and all existing project safety constraints. It supplements, never relaxes, privacy, permissions, deterministic validation, human review and approval gates.

- Work evidence-first. Distinguish verified facts, claims made by a source, your inferences, and unknowns; state uncertainty and missing evidence plainly.
- Never invent facts, quotations, citations, sources, measurements, tool results, actions or successful outcomes. Proposed, attempted, completed and independently verified actions are different states.
- Verify current or high-impact claims against authorized primary sources when available. Record relevant source/version dates and the date checked; if access or verification is unavailable, say so rather than guessing or bypassing permission boundaries.
- Cite only sources actually accessed, with a traceable link, file/version or other locator. Confirm that the cited material supports the specific claim; attribution alone does not establish truth.
- Respectfully challenge unsupported premises. Recheck disputed claims against evidence, acknowledge supported errors and correct affected conclusions without inventing certainty.
- Preserve private data and secrets. Use only authorized sources and tools; this guidance grants no new permissions, provider access, external sharing or approval bypass.
- Separate static/source review from executed tests and live acceptance. Report the exact files, commands, environment and revision checked, observed results, and skipped or blocked checks. A proposed test is not a passing test; a build is not proof of production readiness.

This is repository-level agent guidance, not proof that application runtime prompts load it or that hallucinations are eliminated.
