# Psalm 139 macOS Glass Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a nine-slide English Psalm 139:23-24 PowerPoint through the normal `ppt-agent` run structure, using the approved modern liturgical, macOS glass, and restrained Christ-centered visual direction.

**Architecture:** Keep the standard `openspec/changes/ppt-psalm-139-macos-glass/` artifact structure for the ordinary `ppt-agent` workflow. Author the editable PPTX with `@oai/artifact-tool` in an external scratch workspace, using a content module, a deterministic layout helper module, and a deck composer module. Export slide PNGs and layout JSON for object-level QA, then run PowerPoint overflow and rendered-slide checks against the final file.

**Tech Stack:** Node.js ES modules, `@oai/artifact-tool`, normal `ppt-agent` OpenSpec artifacts, Codex image generation for one atmospheric Christ-centered raster asset, bundled presentation render/QA tools.

---

## File Map

- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/input.md` - normal `ppt-agent` invocation record.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/proposal.md` - purpose and deliverables.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/tasks.md` - phase checklist.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/requirements.md` - approved audience, language, style, and QA constraints.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/materials.md` - source text from the user and seven screenshots.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/brand-style.yaml` - approved visual tokens.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/outline.json` - approved nine-slide structure.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/outline-preview.md` - ordinary `ppt-agent` outline preview.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/planning-validation.json` - outline validator result.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/deck-content.mjs` - all audience-facing copy and speaker notes.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/layout-system.mjs` - design tokens and deterministic glass/card helpers.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/build-deck.mjs` - nine-slide artifact-tool composer and exporter.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/validate-layout.mjs` - slide-count, bounds, font-floor, and one-line-title assertions.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/assets/christ-light-path.png` - generated atmospheric cross/light/path visual.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/source-notes.txt` - source and asset provenance.
- Create: `/var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/qa-ledger.txt` - per-slide visual QA findings and fixes.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/psalm-139-search-me-macos-glass.pptx` - final PowerPoint.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/index.html` - local gallery preview.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/speaker-notes.md` - presenter notes.
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/README.md` - deliverable summary and verification result.

### Task 1: Initialize The Ordinary ppt-agent Run

**Files:**
- Create the nine OpenSpec files listed above through `outline-preview.md`.
- Create the external scratch folders and initialize artifact-tool resolution.

- [ ] **Step 1: Create the run and scratch directories**

Run:

```bash
mkdir -p /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output
mkdir -p /var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/{assets,preview,layout,qa}
```

Expected: both commands exit `0`.

- [ ] **Step 2: Initialize the bundled artifact-tool workspace**

Run:

```bash
node /Users/kevinchen/.codex/plugins/cache/openai-primary-runtime/presentations/26.709.11516/skills/presentations/container_tools/setup_artifact_tool_workspace.mjs --workspace /var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp
```

Expected: dependency setup completes without package-resolution errors.

- [ ] **Step 3: Write the normal-run metadata**

Use these exact values:

```yaml
run_id: ppt-psalm-139-macos-glass
command: /ppt-agent:ppt
pages: 9
language: English
audience: formal church or fellowship sharing
style: modern-liturgical-macos-glass
route_excluded: bible-class
```

Write the approved design requirements from `docs/superpowers/specs/2026-07-10-psalm-139-macos-glass-deck-design.md` into `requirements.md`, and preserve the user's original wording and screenshot paths in `materials.md`.

- [ ] **Step 4: Write and validate the approved outline**

The `outline.json` must contain these page titles in this exact order and set `approved` to `true`:

```json
[
  "Search Me, God",
  "The Prayer We Are Studying",
  "Why Was David Anxious?",
  "What Does ‘Offensive Way’ Mean?",
  "Where Do These Ways Lead?",
  "Navigate Busy or Exhausting Times",
  "Make Big Decisions in Life",
  "When You Feel You Don’t Hear God",
  "A Simple Group Practice"
]
```

Run:

```bash
node /Users/kevinchen/PPT_Agent/ppt-agent/skills/_shared/scripts/planning-validator-cli.js --outline /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/outline.json --targets /Users/kevinchen/PPT_Agent/ppt-agent/skills/_shared/references/density-targets.json --pages 9-9
```

Expected: JSON parses successfully and contains no `hard_errors`.

- [ ] **Step 5: Commit only the normal-run text artifacts**

```bash
git add openspec/changes/ppt-psalm-139-macos-glass/input.md openspec/changes/ppt-psalm-139-macos-glass/proposal.md openspec/changes/ppt-psalm-139-macos-glass/tasks.md openspec/changes/ppt-psalm-139-macos-glass/requirements.md openspec/changes/ppt-psalm-139-macos-glass/materials.md openspec/changes/ppt-psalm-139-macos-glass/brand-style.yaml openspec/changes/ppt-psalm-139-macos-glass/outline.json openspec/changes/ppt-psalm-139-macos-glass/outline-preview.md openspec/changes/ppt-psalm-139-macos-glass/planning-validation.json
git commit -m "feat: initialize Psalm 139 presentation run"
```

### Task 2: Lock Content And Layout Contracts With Tests

**Files:**
- Create: `.../tmp/deck-content.mjs`
- Create: `.../tmp/layout-system.mjs`
- Create: `.../tmp/validate-layout.mjs`

- [ ] **Step 1: Write the content contract**

Export a `DECK` array with these complete visible-content responsibilities:

```js
export const DECK = [
  { id: "title", title: "SEARCH ME, GOD", subtitle: "An honest prayer for anxious thoughts, hidden motives, and the way everlasting." },
  { id: "scripture", title: "The Prayer We Are Studying", quote: ["Search me, God, and know my heart; test me and know my anxious thoughts.", "See if there is any offensive way in me, and lead me in the way everlasting."], verbs: ["SEARCH", "TEST", "SEE", "LEAD"] },
  { id: "anxiety", title: "Why Was David Anxious?", points: ["Violent enemies surrounded him.", "He feared his own internal flaws.", "Being fully known by God carried a humbling weight.", "Anxiety exposed a crisis of trust."] },
  { id: "offensive", title: "What Does ‘Offensive Way’ Mean?", points: ["A path that produces pain or grief.", "A pattern of false trust in control, status, money, or approval.", "A hidden blind spot that quietly pulls us away from God."] },
  { id: "leads", title: "Where Do These Ways Lead?", chain: ["ANXIOUS THOUGHTS", "CONTROL OR WITHDRAWAL", "HURT AND DISTANCE"], resolution: "Surrender lets God lead us in the way everlasting." },
  { id: "busy", title: "Navigate Busy or Exhausting Times", context: "Exhaustion multiplies anxious thoughts and exposes irritability, withdrawal, and self-reliance.", questions: ["What ‘offensive way’ first creeps into your behavior when you are exhausted?", "What specific worry is draining your energy right now?"] },
  { id: "decisions", title: "Make Big Decisions in Life", context: "Before asking God to bless our plan, ask Him to search the motives beneath it.", questions: ["Is control, status, or fear of missing out driving your preference?", "How does God’s complete knowledge of your future reduce the anxiety of choosing?"] },
  { id: "silence", title: "When You Feel You Don’t Hear God", context: "Anxious thoughts can become louder than God’s gentle whisper, while self-reliance adds more noise.", questions: ["When God feels silent, do you fill with anxiety or try to fix everything in your own strength?", "How can asking God to search you clear the mental noise?"] },
  { id: "practice", title: "A Simple Group Practice", steps: ["Search me", "Name what is true", "Receive grace in Christ", "Walk the next faithful step"] }
];
```

- [ ] **Step 2: Write the failing validation script before layout implementation**

```js
import assert from "node:assert/strict";
import { DECK } from "./deck-content.mjs";
import { TOKENS, SLIDE_LAYOUTS } from "./layout-system.mjs";

assert.equal(DECK.length, 9, "deck must contain nine slides");
assert.equal(SLIDE_LAYOUTS.length, 9, "every slide needs a layout record");
assert.ok(TOKENS.titleFontSize >= 50);
assert.ok(TOKENS.slideTitleFontSize >= 35);
assert.ok(TOKENS.bodyFontSize >= 16);

for (const layout of SLIDE_LAYOUTS) {
  assert.ok(layout.left >= 0 && layout.top >= 0);
  assert.ok(layout.left + layout.width <= 1280);
  assert.ok(layout.top + layout.height <= 720);
  assert.ok(layout.safeLeft >= 56 && layout.safeRight <= 1224);
}

console.log("layout contract passed: 9 slides, safe bounds, font floors");
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
node /var/folders/12/hcf280bj3ldfgtx1smbhfk340000gn/T/codex-presentations/019f4c0c-1ad3-7e83-83fb-5826406430e5/psalm-139-macos-glass/tmp/validate-layout.mjs
```

Expected: failure because `layout-system.mjs` or its exports do not exist yet.

- [ ] **Step 4: Implement deterministic design tokens and layout records**

```js
export const TOKENS = {
  canvas: { width: 1280, height: 720 },
  colors: { deepTeal: "#17363B", mist: "#E9EEEB", gold: "#C7A45B", sage: "#7D9B91", ink: "#17363B", ivory: "#F7F3E7" },
  titleFontSize: 58,
  slideTitleFontSize: 38,
  calloutFontSize: 25,
  bodyFontSize: 18,
  safe: { left: 56, right: 1224, top: 42, bottom: 680 },
  radius: { card: "rounded-2xl", capsule: "rounded-full" }
};

export const SLIDE_LAYOUTS = Array.from({ length: 9 }, (_, index) => ({
  index: index + 1,
  left: 0,
  top: 0,
  width: 1280,
  height: 720,
  safeLeft: TOKENS.safe.left,
  safeRight: TOKENS.safe.right
}));
```

Add reusable `addHeader`, `addGlassCard`, `addCapsule`, `addQuestionCard`, and `addCrossAnchor` helpers. Each helper must accept an explicit `position` object and must not infer placement from text length.

- [ ] **Step 5: Run the contract test and verify it passes**

Expected output:

```text
layout contract passed: 9 slides, safe bounds, font floors
```

### Task 3: Generate The Christ-Centered Visual Asset

**Files:**
- Create: `.../tmp/assets/christ-light-path.png`
- Create: `.../tmp/source-notes.txt`

- [ ] **Step 1: Generate one restrained 16:9 raster asset**

Invoke the image generation skill with this prompt:

```text
Minimal contemporary church visual for a formal Bible study presentation, deep liturgical teal atmosphere, a subtle warm-gold cross formed by soft natural light, a quiet path leading toward the light, mist-white negative space on the left for typography, refined modern sacred mood, no people, no text, no logos, no ornate decoration, photorealistic but understated, 16:9 widescreen.
```

Use it only on the title and closing slide with different crops. Do not reuse it on the seven content slides.

- [ ] **Step 2: Inspect the asset at full size**

Verify: the cross is visible but not dominant; no text or human figure is present; the left side remains quiet enough for a glass text surface.

- [ ] **Step 3: Record provenance**

Write the user-provided screenshot paths and the generated-asset prompt into `source-notes.txt`.

### Task 4: Build The Nine Slides With artifact-tool

**Files:**
- Create: `.../tmp/build-deck.mjs`
- Output: final PPTX, nine PNG previews, nine layout JSON files, and one montage.

- [ ] **Step 1: Create the presentation and shared chrome**

Use:

```js
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
```

Every slide receives a 56 px left safe line, a section capsule at the upper left, and a page counter at the upper right. All element names must be stable, such as `s06-title`, `s06-question-1`, and `s06-topic-panel`.

- [ ] **Step 2: Compose slides 1-5**

- Slide 1: full-bleed generated image, one large glass title panel, one cross/light anchor.
- Slide 2: dominant scripture glass panel and four vertically aligned verb capsules.
- Slide 3: one thesis surface plus four supporting statements arranged on a strict two-column grid.
- Slide 4: one definition surface plus three large capsules for pain, false trust, and blind spots.
- Slide 5: one horizontal causal sequence with three capsules and a separate surrender resolution surface.

Use a single line for slide titles; if a title requires more than its assigned width, reduce the wording rather than the font floor.

- [ ] **Step 3: Compose slides 6-8**

Each application slide uses the same coordinate skeleton:

```js
const APP_LAYOUT = {
  topic: { left: 56, top: 112, width: 392, height: 520 },
  question1: { left: 480, top: 154, width: 744, height: 186 },
  question2: { left: 480, top: 370, width: 744, height: 186 }
};
```

Keep the two question cards at identical sizes so dynamic text cannot shift neighboring components.

- [ ] **Step 4: Compose slide 9**

Use the generated visual as a restrained background crop. Place one Christ-centered glass panel on the left and four floating practice capsules on the right. The visible summary must read: `Let Christ lead what God reveals.`

- [ ] **Step 5: Add speaker notes and export evidence**

For each slide, add notes containing the teaching purpose and suggested transition. Export:

```js
const png = await presentation.export({ slide, format: "png", scale: 1 });
const layout = await slide.export({ format: "layout" });
const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
const pptx = await PresentationFile.exportPptx(presentation);
```

Expected: nine PNGs, nine layout JSON files, one WebP montage, and one PPTX.

### Task 5: Build Normal ppt-agent Delivery Artifacts

**Files:**
- Create: `output/index.html`
- Create: `output/speaker-notes.md`
- Create: `output/README.md`

- [ ] **Step 1: Create the HTML gallery**

Use the nine exported PNGs with Gallery, Scroll, and Present modes. The gallery must use relative image paths so it opens locally from the output folder.

- [ ] **Step 2: Write speaker notes**

Create one section per slide with the slide title, speaking aim, and transition. Keep notes out of visible slide content.

- [ ] **Step 3: Update the phase checklist**

Mark Init, Research/Requirements, Outline, Draft/Build, Design, and Delivery complete only after their artifacts exist.

### Task 6: Render And Repair Every Slide

**Files:**
- Update: `.../tmp/build-deck.mjs` for fixes.
- Create: `.../tmp/qa-ledger.txt`.

- [ ] **Step 1: Run programmatic layout checks**

Run the layout contract and parse all nine layout JSON files. Fail if any element is outside `0,0,1280,720`, any visible title is below 35 px, or any body text is below 16 px.

- [ ] **Step 2: Render the final PPTX independently**

Run:

```bash
/Users/kevinchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/kevinchen/.codex/plugins/cache/openai-primary-runtime/presentations/26.709.11516/skills/presentations/container_tools/render_slides.py /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/psalm-139-search-me-macos-glass.pptx
```

Expected: nine rendered PNG files.

- [ ] **Step 3: Inspect every rendered slide at full size**

For slides 1 through 9, record `pass` or a concrete repair in `qa-ledger.txt`. Check title wrapping, text clipping, question-card consistency, glass-card borders, page counters, and cross/image crop.

- [ ] **Step 4: Repair and re-export**

Change only the smallest responsible position or copy field. Re-run build, layout checks, and the independent render after each repair batch.

- [ ] **Step 5: Create the deck-level montage**

Run:

```bash
/Users/kevinchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/kevinchen/.codex/plugins/cache/openai-primary-runtime/presentations/26.709.11516/skills/presentations/container_tools/create_montage.py --input_dir /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/psalm-139-search-me-macos-glass --output_file /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/pptx-montage.png
```

Use the montage only to verify narrative rhythm and visual consistency.

### Task 7: Final Verification And Delivery

**Files:**
- Update: `output/README.md`
- Final: `output/psalm-139-search-me-macos-glass.pptx`

- [ ] **Step 1: Run PowerPoint overflow testing**

```bash
/Users/kevinchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/kevinchen/.codex/plugins/cache/openai-primary-runtime/presentations/26.709.11516/skills/presentations/container_tools/slides_test.py /Users/kevinchen/PPT_Agent/ppt-agent/openspec/changes/ppt-psalm-139-macos-glass/output/psalm-139-search-me-macos-glass.pptx
```

Expected: `Test passed. No overflow detected.`

- [ ] **Step 2: Verify package counts and required deliverables**

Check that the PPTX contains nine slide XML files, the render directory contains nine PNGs, and `index.html`, `speaker-notes.md`, `README.md`, and `pptx-montage.png` exist.

- [ ] **Step 3: Update README with exact verification evidence**

Record the slide count, overflow-test result, render count, and final file size. Do not claim completion until all evidence is fresh.

- [ ] **Step 4: Commit only the new presentation run artifacts**

```bash
git add openspec/changes/ppt-psalm-139-macos-glass
git commit -m "feat: create Psalm 139 macOS glass presentation"
```

- [ ] **Step 5: Deliver the final PPTX**

Return the clickable final PPTX path and a short note that the ordinary `ppt-agent` route was used and all nine rendered slides passed alignment and overflow checks.
