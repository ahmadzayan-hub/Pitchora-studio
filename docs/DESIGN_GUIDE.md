# Pitchora design and motion guide

## Purpose and authority

Pitchora helps a presenter defend a source-led, editable presentation. Follow
[product authority](PRODUCT_AUTHORITY.md), [repository boundaries](REPOSITORY_GUIDE.md)
and [Source Studio's actual capabilities](SOURCE_STUDIO.md). This is guidance,
not a new theme, shipped UI feature or claim of verified production readiness.

Evidence readability and honest review state come before cinematic effects.
Keep existing Pitchora branding and `/presentiq` routes. Do not extend inherited
Maktab/client areas under a design-polish task. Preserve existing design tokens
and any user-selected UI/UX Pro Max workflow rather than shadowing them.

## Routing

- Motion review: explicitly select [review-animations](../.agents/skills/review-animations/SKILL.md).
  Return findings and tests first; a review is not permission to implement them.
- Narrow interface polish: explicitly select [emil-design-eng](../.agents/skills/emil-design-eng/SKILL.md).
  Use the actual brief and existing visual system; do not redesign by default.
- Evidence/data correctness, authentication or export logic: use the project's
  ordinary engineering checks, not a design skill as a substitute.

The adapted entries are manual-invocation guidance. Upstream copies, support
files, MIT notices and pinned hashes are included; see
[provenance](../.agents/skills/provenance.json). They are not installed in a
personal ChatGPT account and do not execute scripts on load.

## Interface constraints

1. Keep citations, source names, page/span references and unsupported/reviewed
   state visible and distinguishable. Never shrink or hide evidence to fit an effect.
2. Preserve explicit human review. In Source Studio, editing a scene currently
   resets its reviewed state; a visual refactor must not change that behavior.
3. Support English and Arabic RTL, mixed-direction filenames/numbers/URLs,
   logical spacing, long text and narrow viewports. Do not fabricate translations.
4. All controls remain keyboard accessible with visible focus. Hover or pointer
   animation cannot be the only way to discover or activate a control.
5. Reduced-motion rendering can be completely static. Preserve content when
   scripting, animation or observers do not run, and when printing/exporting.
6. Motion must explain a state change or improve orientation. Avoid decorative
   scroll sequences in source review or editing. Never animate citations while read.
7. Keep source documents local where the workflow promises local processing.
   No remote asset search, generation, source upload or service spending follows
   from selecting one of these skills.

## Existing implementation, not a new animation stack

At the integration baseline, `package.json` includes `framer-motion` but no GSAP.
[Pitchora motion primitives](../src/components/presentiq/ui/motion.tsx) use React
and CSS; [global styles](../src/app/globals.css) include reduced-motion rules.
`Reveal` deliberately keeps content visible after historical observer/screenshot
failures. Do not reintroduce opacity-gated content or duplicate these primitives.
Use existing tools first. This guidance adds no GSAP package, runtime dependency,
installer, hook, binary, paid provider or external component registry.

GSAP skills were considered but not activated because there is no matching
runtime integration. Open Design is a separate app/catalog. React Bits and
Canvas UI are component libraries with additional licensing restrictions, not
account skills. Impeccable's launcher and paid/optional generation paths in
Hallmark and Scroll World are outside this no-execution, no-expense addition.

## Acceptance for a future UI change

- Check an English and Arabic scene with long source names and mixed-direction
  page/span references at desktop and narrow mobile widths.
- Verify keyboard navigation, visible focus, repeated edits and review-state reset.
- Check reduced motion both on initial load and changed during the session.
- Verify content remains visible in full-page screenshots, print and affected
  HTML/PPTX outputs. Do not claim those checks ran from a Markdown-only change.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and affected
  browser/media checks as described in [the repository guide](REPOSITORY_GUIDE.md).
- Check this integration with `python3 scripts/test-design-skills.py`.

## One bounded follow-on recommendation (not implemented)

In [motion.tsx](../src/components/presentiq/ui/motion.tsx), `Magnetic`, `Tilt`
and `ParallaxMesh` check `prefersReducedMotion()` when their effect mounts, but
currently do not subscribe to changes to that media query. A narrow follow-on
could detach pointer listeners and reset transforms immediately when a user
turns reduced motion on while the page is open, and gate pointer decoration to
fine/hover-capable pointers. Test the live preference toggle and listener cleanup
without changing `Reveal`, adding a library or touching Source Studio data.
This is a code-grounded recommendation, not a browser-verified defect claim.
