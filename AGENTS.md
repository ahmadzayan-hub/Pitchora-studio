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
