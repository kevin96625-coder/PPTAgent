'use strict';
const { contrastRatio, adjustToContrast, relLuminance } = require('./color-contrast');

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

  return { svg: out, fixes };
}
module.exports = { autofixSvg };
