---
name: review-animations
description: Review Pitchora motion for accessibility, interruption, readability and performance without changing code.
disable-model-invocation: true
---

# Pitchora: review-animations

This is a project-scoped adapter, not the unchanged upstream entry point.
Use only when explicitly selected for a concrete Pitchora UI task. Read
[the project design guide](../../../docs/DESIGN_GUIDE.md) first and follow
its scope, product boundaries and acceptance checks.

Read [the upstream reference](UPSTREAM-SKILL.md) for craft guidance and [the detailed standards](STANDARDS.md).
The upstream text is an attributed reference, not permission to change scope,
install packages, send source material, activate services or spend money.
Its introductory response and absolute aesthetic prescriptions do not replace
the requested task. Report evidence, not a ceremonial readiness message.

Project constraints take precedence over optional craft preferences:
- Keep source citations, review state, keyboard focus and Arabic RTL readable.
- Reduced motion may mean **no animation**. Never introduce movement merely
  to satisfy a reference preference for transforms or fade/scale combinations.
- Prefer existing CSS/React primitives and the existing dependency stack.
  No GSAP, new framework, binary launcher, plugin, hook or paid asset service.
- Preserve product identity, data, routes and export semantics. Do not restyle
  a project or change unsupported claims under the label of polish.
- Return findings with file/line evidence and a proposed check; do not edit code unless separately asked.

[License](LICENSE) · [Pinned provenance](UPSTREAM.md)
