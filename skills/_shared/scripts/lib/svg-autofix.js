'use strict';
const { contrastRatio, adjustToContrast, relLuminance } = require('./color-contrast');

// Compute nesting-aware character ranges covered by any container ... </container>
// matching `gOpenRe`. Containers tracked: <g>, plus <a>, <switch>, and nested <svg>
// — text inside ANY of these is "nested" and must bypass the top-level contrast /
// safe-area passes (their effective surface / coordinate system is unknowable from
// the markup). Returns { inRange(i) } true iff index i sits strictly inside such a
// container. We track ALL container open/close for correct nesting, but only emit
// ranges for opens whose tag matches gOpenRe.
function groupRanges(s, gOpenRe) {
  const ranges = [];
  const stack = [];
  // Open tags for g/a/switch/svg (ignore self-closing "<.../>"), plus their closers.
  const tokRe = /<(g|a|switch|svg)\b(?:[^>]*[^/>])?>|<\/(g|a|switch|svg)>/g;
  let svgDepth = 0;
  let t;
  while ((t = tokRe.exec(s))) {
    const isClose = t[0].startsWith('</');
    const name = isClose ? t[2] : t[1];
    if (isClose) {
      const o = stack.pop();
      // The outermost (root) <svg> document element must NOT count as a nesting
      // container — otherwise every element would be "nested". Only nested <svg>
      // (depth > 1) acts as a boundary.
      if (o && o.tag !== '__root_svg__' && gOpenRe.test(o.tag)) ranges.push([o.index, t.index]);
      if (name === 'svg') svgDepth--;
    } else {
      if (name === 'svg') {
        svgDepth++;
        // Mark the root svg so its range is never emitted.
        stack.push({ index: t.index, tag: svgDepth === 1 ? '__root_svg__' : t[0] });
      } else {
        stack.push({ index: t.index, tag: t[0] });
      }
    }
  }
  return { inRange: (i) => ranges.some(([a, b]) => i > a && i < b) };
}

// Operate on <text>/<tspan> tags via regex (no XML dep; project convention; real slide tags are single-line).
function autofixSvg(svg, opts = {}) {
  const fontFloor = opts.fontFloor || 14;
  const labelFloor = opts.labelFloor || 12;
  const fixes = [];
  let out = svg;

  // --- font floor: raise any font-size below the applicable floor ---
  out = out.replace(/<(text|tspan)\b[^>]*>/g, (tag) => {
    const m = tag.match(/font-size="([0-9.]+)"/);
    if (!m) return tag;
    const size = parseFloat(m[1]);
    const isLabel = /data-role="(label|footnote)"/.test(tag);
    const floor = isLabel ? labelFloor : fontFloor;
    if (size >= floor) return tag;
    fixes.push({ type: 'font-floor', detail: `${size}->${floor}` });
    return tag.replace(/font-size="[0-9.]+"/, `font-size="${floor}"`);
  });

  // --- text contrast: lighten/darken text fills that fail vs the page background ---
  // ONLY top-level <text>/<tspan> (no <g> ancestor) are touched. Nested text lives
  // inside cards/badges/buttons with their own fills (plus transform/z-order), so the
  // real surface behind it is unknowable from the markup — guessing a "worst-case"
  // surface caused a "fix makes it worse" regression (dark text deliberately placed
  // on a bright badge got lightened, reducing its true contrast). Nested text is
  // instead covered by Gemini's visual review (M2.5), which sees rendered pixels.
  // Top-level text genuinely sits on the page background, so we measure against it.
  const tok = opts.tokens || {};
  const bg = tok.background || tok.primary;
  // M2.5 hero layout: a full-bleed <image> (covers the 1280x720 canvas) means
  // top-level text actually sits on the photo, NOT the page background token.
  // Judging it against `background` mis-recolors correct hero titles (e.g. a white
  // title on a dark photo under a light theme). Defer such slides to Gemini's
  // visual review (same rationale as nested text) — skip the contrast pass entirely.
  const hasFullBleedImage = [...out.matchAll(/<image\b[^>]*>/g)].some((im) => {
    const wm = im[0].match(/\bwidth="([0-9.]+)"/);
    const hm = im[0].match(/\bheight="([0-9.]+)"/);
    return wm && hm && parseFloat(wm[1]) >= 1200 && parseFloat(hm[1]) >= 680;
  });
  if (bg && !hasFullBleedImage) {
    const dark = relLuminance(bg) < 0.5;
    const surface = bg;
    const dir = dark ? 'lighten' : 'darken';
    // nesting-aware decorative ranges: text whose tag start sits inside a
    // <g data-decorative="true"> ... </g> group must never be recolored.
    const { inRange: inDeco } = groupRanges(out, /data-decorative="true"/);
    // Match ALL <g> groups so any group nesting disqualifies text from a contrast fix
    // (mirrors the safe-area rule below — top-level only).
    const { inRange: inAnyG } = groupRanges(out, /^/);
    // Rebuild manually from matchAll so each tag's true start offset is available.
    const matches = [...out.matchAll(/<(text|tspan)\b([^>]*)>/g)];
    let rebuilt = '';
    let cursor = 0;
    for (const mt of matches) {
      const tag = mt[0];
      const attrs = mt[2];
      const idx = mt.index;
      rebuilt += out.slice(cursor, idx);
      cursor = idx + tag.length;
      let newTag = tag;
      if (!inAnyG(idx) && !inDeco(idx) && !/data-decorative="true"/.test(tag)) {
        const fm = attrs.match(/fill="(#[0-9a-fA-F]{3,6})"/);
        if (fm) {
          // WCAG AA: 4.5:1 for normal text. NOTE (deviation from plan §3.1.2):
          // the plan suggested a 3:1 floor for large text, but the Task-3 red-line
          // test requires `#6366f1` (3.99:1 vs the #0f172a background) to be fixed —
          // it already exceeds 3:1, so a 3:1 large-text floor can never satisfy that
          // test. We therefore use 4.5:1 as the default and only grant the 3:1
          // exception to genuinely large display text (font-size >= 40). This is
          // strictly safer (it can only raise contrast further) and does not weaken
          // either safety red-line. The 34px title above lands at 4.5:1.
          const fsm = attrs.match(/font-size="([0-9.]+)"/);
          const largeDisplay = fsm && parseFloat(fsm[1]) >= 40;
          const target = largeDisplay ? 3 : 4.5;
          if (contrastRatio(fm[1], surface) < target) {
            const fixed = adjustToContrast(fm[1], surface, target, dir);
            if (fixed.toLowerCase() !== fm[1].toLowerCase()) {
              fixes.push({ type: 'contrast', detail: `${fm[1]}->${fixed}` });
              newTag = tag.replace(/fill="#[0-9a-fA-F]{3,6}"/, `fill="${fixed}"`);
            }
          }
        }
      }
      rebuilt += newTag;
    }
    rebuilt += out.slice(cursor);
    out = rebuilt;
  }

  // --- safe-area: only top-level (no <g> / transform ancestor) role-tagged
  //     title / page-number get coordinate clamps. Nested elements use legitimate
  //     local coordinates and must NEVER be moved. Match ALL <g> groups (not just
  //     transformed ones) so any group nesting disqualifies a text from clamping.
  {
    const { inRange: inAnyG } = groupRanges(out, /^/); // /^/ matches every <g> open
    const matches = [...out.matchAll(/<text\b[^>]*>/g)];
    let rebuilt = '';
    let cursor = 0;
    for (const mt of matches) {
      const tag = mt[0];
      const idx = mt.index;
      rebuilt += out.slice(cursor, idx);
      cursor = idx + tag.length;
      let t2 = tag;
      // Skip text that carries its OWN transform: it positions itself in a custom
      // coordinate system, so a raw y/x clamp would be wrong (clamping y->92 on a
      // tag already translated would push it off its intended spot). I2 fix.
      if (!inAnyG(idx) && !/\btransform=/.test(tag)) {
        const role = (tag.match(/data-role="([^"]+)"/) || [])[1];
        if (role === 'title' || role === 'page-number') {
          const ym = tag.match(/\by="(-?[0-9.]+)"/);
          const xm = tag.match(/\bx="(-?[0-9.]+)"/);
          if (role === 'title' && ym && parseFloat(ym[1]) < 92) {
            t2 = t2.replace(/\by="-?[0-9.]+"/, 'y="92"');
            fixes.push({ type: 'safe-area', detail: 'title y->92' });
          }
          if (role === 'page-number') {
            if (ym && parseFloat(ym[1]) > 688) {
              t2 = t2.replace(/\by="-?[0-9.]+"/, 'y="688"');
              fixes.push({ type: 'safe-area', detail: 'pagenum y->688' });
            }
            if (xm && parseFloat(xm[1]) > 1220) {
              t2 = t2.replace(/\bx="-?[0-9.]+"/, 'x="1220"');
              fixes.push({ type: 'safe-area', detail: 'pagenum x->1220' });
            }
          }
        }
      }
      rebuilt += t2;
    }
    rebuilt += out.slice(cursor);
    out = rebuilt;
  }

  return { svg: out, fixes };
}
module.exports = { autofixSvg };
