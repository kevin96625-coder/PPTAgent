'use strict';
// P3 type-scale analyzer (READ-ONLY).
//
// IRON RULE: this module NEVER rewrites the SVG. It takes an SVG string and
// returns an analysis object. It exports no function that returns a modified
// SVG, and it never throws — parsing is wrapped and degrades to an empty
// analysis with an info-level note. All warnings are advisory (soft-warn);
// none is ever a hard error.
//
// Regex-based SVG parsing (no XML dependency), matching svg-autofix.js style.

const DEFAULT_LADDER = { h1: 64, h2: 40, h3: 28, body: 18, label: 15, caption: 14, micro: 12 };
const TOO_MANY = 6;        // > this many distinct sizes -> visual noise
const OFF_THRESHOLD = 0.25; // relative deviation from nearest rung
const MICRO_FLOOR = 14;     // sizes below this are exempt from off-ladder (page numbers, badges)

// Collect every <text>/<tspan> with a font-size, skipping data-decorative ones.
function collectSizes(svg) {
  const sizes = [];
  const re = /<(text|tspan)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(svg))) {
    const attrs = m[2];
    if (/data-decorative="true"/.test(attrs)) continue;
    const fm = attrs.match(/font-size="([0-9.]+)"/);
    if (!fm) continue;
    const v = parseFloat(fm[1]);
    if (Number.isFinite(v) && v > 0) sizes.push(v);
  }
  return sizes;
}

function analyzeTypeScale(svg, opts = {}) {
  const ladder = opts.ladder || DEFAULT_LADDER;
  const effectiveScale = opts.effectiveScale;
  const bestEffort = !(typeof effectiveScale === 'number' && Number.isFinite(effectiveScale) && effectiveScale > 0);
  const scale = bestEffort ? 1 : effectiveScale;

  const result = { distinctSizes: 0, sizes: [], offLadder: [], warnings: [] };

  let raw;
  try {
    if (typeof svg !== 'string') {
      result.warnings.push({ code: 'parse-skip', level: 'info', detail: 'input is not an SVG string; analysis skipped' });
      return result;
    }
    raw = collectSizes(svg);
  } catch (e) {
    result.warnings.push({ code: 'parse-skip', level: 'info', detail: `parse failed, analysis skipped: ${String(e && e.message || e)}` });
    return result;
  }

  const unique = [...new Set(raw)].sort((a, b) => a - b);
  result.sizes = unique;
  result.distinctSizes = unique.length;

  // Rungs scaled by the effective render scale (so cover/data pages aren't mis-flagged).
  const rungs = Object.values(ladder).map((v) => v * scale).filter((v) => Number.isFinite(v) && v > 0);

  // too-many-sizes: scale-insensitive, the primary robust signal.
  if (result.distinctSizes > TOO_MANY) {
    result.warnings.push({
      code: 'too-many-sizes',
      level: 'warn',
      detail: `字号种数过多(${result.distinctSizes}),易成视觉噪声;建议收敛到阶梯 7 档内`,
    });
  }

  // off-ladder: per size >= MICRO_FLOOR, relative deviation from nearest rung > threshold.
  for (const size of unique) {
    if (size < MICRO_FLOOR) continue; // exempt micro / page numbers / badges
    if (!rungs.length) continue;
    let nearest = rungs[0];
    let bestDelta = Math.abs(size - nearest) / nearest;
    for (const r of rungs) {
      const d = Math.abs(size - r) / r;
      if (d < bestDelta) { bestDelta = d; nearest = r; }
    }
    if (bestDelta > OFF_THRESHOLD) {
      const entry = {
        size,
        nearest: Math.round(nearest * 100) / 100,
        deltaPct: Math.round(bestDelta * 1000) / 10,
      };
      if (bestEffort) entry.bestEffort = true;
      result.offLadder.push(entry);
    }
  }

  if (result.offLadder.length) {
    // Summarize into ONE advisory warning (don't spam per-size).
    const list = result.offLadder.map((o) => o.size).join(', ');
    result.warnings.push({
      code: 'off-ladder',
      level: bestEffort ? 'info' : 'warn',
      detail: bestEffort
        ? `字号 [${list}] 偏离阶梯档位(best-effort:未知有效 scale,仅供参考)`
        : `字号 [${list}] 明显偏离最近阶梯档位(>${Math.round(OFF_THRESHOLD * 100)}%),建议就近选档`,
    });
  }

  return result;
}

module.exports = { analyzeTypeScale, DEFAULT_LADDER };
