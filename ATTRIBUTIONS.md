# Attributions

## Akxan / ppt-agent-skill

Portions of this repository's design-reference library are **ported and adapted** from
**Akxan / ppt-agent-skill**, released under the **MIT License, © 2025 sunbigfly**
(upstream discussion: linux.do/1782304).

The ported material is **design guidance only** (taxonomy, when-to-use, design soul,
gravity-field philosophy, color/failure-mode principles). It has been **adapted to this
repository's model**, not copied verbatim:

- **Output model**: Akxan is an HTML/CSS → screenshot pipeline; this repo emits **pure SVG**
  (1280×720 viewBox, `${token}` hex fills). All HTML/CSS chart templates and CSS-only
  techniques were dropped or rewritten as minimal SVG skeletons (`<g transform>`,
  `<polygon>`, `<rect fill="${accent}">`). No `<div>`, no `backdrop-filter`, no `mask-image`.
- **Schema**: Akxan's `planning.json` / `cards[]` field references were **rewritten** to this
  repo's `outline.json` schema (`pages[].{type,layout_type,data_elements,visual_weight,key_message,asset}`).
- **Layout enum**: this repo has a fixed 10-value `layout_type` enum (hard-checked by
  `planning-validator.js`). The ported layout material **deepens the rendering of those 10
  values only** — it adds no new enum value and touches no validator.

The design principles themselves are general-purpose design knowledge, not original to the
upstream post (设计规范属通用,非原帖).

### Ported & adapted files (adapted to this repo's SVG output + outline.json schema)

| File | Adapted from (Akxan) | What was adapted |
|------|----------------------|------------------|
| `skills/_shared/references/principles/failure-modes.md` | `principles/failure-modes.md` + `runtime-failure-modes.md` | 8 failure modes + fix-priority; terms remapped to outline/SVG |
| `skills/_shared/references/design-cheatsheet.md` | `principles/design-principles-cheatsheet.md` | CRAP guardrail; every field rewritten to this repo's `pages[]` schema |
| `skills/_shared/references/blocks.md` | `blocks/*.md` | component design souls; HTML dropped, SVG landing hints added |
| `skills/_shared/references/charts-catalog.md` | `charts/{index,basic,advanced,complex}.md` | chart taxonomy + selection matrix; radar/funnel/gauge/waffle as minimal SVG |
| `skills/_shared/references/color-psychology.md` | `principles/color-psychology.md` | 60/30/10 + emotion + contrast; tied to P3 `color_ratio`, CSS-vars → tokens |
| `skills/_shared/references/layout-craft.md` | `layouts/{hero-top,l-shape,t-shape,waterfall,primary-secondary}.md` + README | gravity-field philosophy mapped onto the existing 10 `layout_type` values |

Each ported file carries the attribution header inline.
