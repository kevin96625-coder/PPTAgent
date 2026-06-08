'use strict';
// P3 color-ratio analyzer (READ-ONLY).
//
// IRON RULE: this module NEVER rewrites the SVG. It takes an SVG string and
// returns an analysis object. It exports no function that returns a modified
// SVG, and it never throws — parsing is wrapped and degrades to a safe empty
// analysis. All warnings are advisory (soft-warn); none is ever a hard error.
//
// It estimates a 60/30/10 area distribution from explicitly-filled basic shapes
// (rect/circle/ellipse). <path>/<image>/no-geometry shapes are skipped (no
// reliable area). This is a coarse geometric estimate, never pixel truth — hence
// the always-present `caveat`.
//
// Reuses color-contrast.hexToRgb for hex->rgb (no duplicated WCAG math).

const { hexToRgb } = require('./color-contrast');

const CANVAS = 1280 * 720;          // 921600
const INSUFFICIENT_FRACTION = 0.30; // measurable area below this -> guard
const DECORATIVE_MIN_FRACTION = 0.005; // decorative shapes under 0.5% canvas ignored
const MATCH_THRESHOLD = 48;         // RGB euclidean distance to count as same token
const AMBIGUITY_MARGIN = 12;        // if a different-bucket token is within d0+this, fill is ambiguous -> other
const ACCENT_OVERLOAD = 0.25;       // accent share above this -> warn
const NO_DOMINANT = 0.35;           // dominant share below this -> warn
const FULL_BLEED_W = 0.90 * 1280;   // >= this rect width counts as a full-bleed background (1152)
const FULL_BLEED_H = 0.90 * 720;    // >= this rect height counts as a full-bleed background (648)

const CAVEAT = '基于 SVG 基本形(rect/circle/ellipse)几何面积估算,非像素真值;path/渐变/图片/图表多色未计入,仅作方向性参考。';

function num(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}="(-?[0-9.]+)"`));
  return m ? parseFloat(m[1]) : null;
}

function shapeArea(tagName, tag) {
  if (tagName === 'rect') {
    const w = num(tag, 'width'); const h = num(tag, 'height');
    if (w != null && h != null && w > 0 && h > 0) return w * h;
    return null;
  }
  if (tagName === 'circle') {
    const r = num(tag, 'r');
    if (r != null && r > 0) return Math.PI * r * r;
    return null;
  }
  if (tagName === 'ellipse') {
    const rx = num(tag, 'rx'); const ry = num(tag, 'ry');
    if (rx != null && ry != null && rx > 0 && ry > 0) return Math.PI * rx * ry;
    return null;
  }
  return null;
}

// Build bucketName -> [rgb,...] from the buckets map + colorScheme tokens.
function buildBucketColors(colorScheme, buckets) {
  const out = { dominant: [], secondary: [], accent: [] };
  for (const bucket of ['dominant', 'secondary', 'accent']) {
    const tokens = (buckets && buckets[bucket]) || [];
    for (const tok of tokens) {
      const hex = colorScheme && colorScheme[tok];
      const rgb = hex ? hexToRgb(hex) : null;
      if (rgb) out[bucket].push(rgb);
    }
  }
  return out;
}

function dist2(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

// Find which bucket a fill hex belongs to (nearest token within threshold), else
// 'other'. Distances are compared in RGB-euclidean units (we sqrt the squared
// distances so the AMBIGUITY_MARGIN is expressed in plain RGB units).
//
// Ambiguity guard: on dark themes, background↔card_bg token distances can be
// well within the outer MATCH_THRESHOLD, so a hand-tuned between-color could land
// in the wrong bucket. After finding the nearest token (distance d0), if the
// nearest token belonging to a *different* bucket is within d0 + AMBIGUITY_MARGIN
// RGB units, we classify the fill as 'other' (the safe choice) instead of
// guessing. Exact-token fills (d0 = 0, cross-bucket >= ~20) stay correctly
// assigned.
function bucketFor(hex, bucketColors) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'other';
  // Nearest token distance (RGB units) within each bucket.
  const perBucket = {};
  for (const bucket of ['dominant', 'secondary', 'accent']) {
    let d = Infinity;
    for (const c of bucketColors[bucket]) d = Math.min(d, Math.sqrt(dist2(rgb, c)));
    perBucket[bucket] = d;
  }
  let best = null; let bestD = Infinity;
  for (const bucket of ['dominant', 'secondary', 'accent']) {
    if (perBucket[bucket] < bestD) { bestD = perBucket[bucket]; best = bucket; }
  }
  if (!best || bestD > MATCH_THRESHOLD) return 'other';
  // Nearest token in a *different* bucket than the winner.
  let otherBucketD = Infinity;
  for (const bucket of ['dominant', 'secondary', 'accent']) {
    if (bucket !== best) otherBucketD = Math.min(otherBucketD, perBucket[bucket]);
  }
  // Ambiguous between two buckets -> safe 'other' instead of guessing.
  if (otherBucketD <= bestD + AMBIGUITY_MARGIN) return 'other';
  return best;
}

function emptyResult(extra) {
  return Object.assign({
    distribution: { dominant: 0, secondary: 0, accent: 0, other: 0 },
    budget: { dominant: 0.6, secondary: 0.3, accent: 0.1 },
    deviations: [],
    warnings: [],
    caveat: CAVEAT,
  }, extra || {});
}

function analyzeColorRatio(svg, opts = {}) {
  const colorScheme = opts.colorScheme || {};
  const colorRatio = opts.colorRatio || {};
  const buckets = colorRatio.buckets || {};
  const budget = {
    dominant: (colorRatio.dominant != null ? colorRatio.dominant : 60) / 100,
    secondary: (colorRatio.secondary != null ? colorRatio.secondary : 30) / 100,
    accent: (colorRatio.accent != null ? colorRatio.accent : 10) / 100,
  };

  if (typeof svg !== 'string') {
    return emptyResult({ insufficient_area: true, warnings: [{ code: 'parse-skip', level: 'info', detail: 'input is not an SVG string; analysis skipped' }] });
  }

  let areas;
  let hasFullBleedBackground = false;
  try {
    const bucketColors = buildBucketColors(colorScheme, buckets);
    areas = { dominant: 0, secondary: 0, accent: 0, other: 0 };
    const re = /<(rect|circle|ellipse)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(svg))) {
      const tagName = m[1];
      const tag = m[0];
      // Full-bleed background detection: a <rect> spanning >=90% of the canvas
      // in both dimensions counts as a dominant background regardless of how it
      // is filled (flat token, gradient url(), image, etc.). This holds even
      // when the rect's fill is NOT a measurable flat token (the idiomatic
      // gradient bg `fill="url(#grad)"`), so it must be checked before the
      // hex-fill skip below.
      if (tagName === 'rect') {
        const w = num(tag, 'width'); const h = num(tag, 'height');
        if (w != null && h != null && w >= FULL_BLEED_W && h >= FULL_BLEED_H) {
          hasFullBleedBackground = true;
        }
      }
      const area = shapeArea(tagName, tag);
      if (area == null || !(area > 0)) continue; // no reliable geometry -> skip
      const decorative = /data-decorative="true"/.test(tag);
      if (decorative && area < DECORATIVE_MIN_FRACTION * CANVAS) continue;
      const fm = tag.match(/fill="(#[0-9a-fA-F]{3,6})"/);
      if (!fm) continue; // no explicit hex fill (url()/none/inherit) -> skip
      const bucket = bucketFor(fm[1], bucketColors);
      areas[bucket] += area;
    }
  } catch (e) {
    return emptyResult({ insufficient_area: true, warnings: [{ code: 'parse-skip', level: 'info', detail: `parse failed, analysis skipped: ${String(e && e.message || e)}` }] });
  }

  const measurable = areas.dominant + areas.secondary + areas.accent + areas.other;

  // Insufficient-area guard: most of the layout is path/gradient/image/chart,
  // so a geometric estimate would mislead. Skip color warnings entirely.
  if (measurable < INSUFFICIENT_FRACTION * CANVAS) {
    return emptyResult({ insufficient_area: true });
  }

  const threeTotal = areas.dominant + areas.secondary + areas.accent;
  const distribution = { dominant: 0, secondary: 0, accent: 0, other: 0 };
  if (threeTotal > 0) {
    distribution.dominant = areas.dominant / threeTotal;
    distribution.secondary = areas.secondary / threeTotal;
    distribution.accent = areas.accent / threeTotal;
  }
  // `other` reported as a share of measurable area (informational; not in denominator).
  distribution.other = measurable > 0 ? areas.other / measurable : 0;

  const deviations = ['dominant', 'secondary', 'accent'].map((b) => ({
    bucket: b,
    actual: Math.round(distribution[b] * 1000) / 1000,
    target: budget[b],
    deltaPP: Math.round((distribution[b] - budget[b]) * 1000) / 10,
  }));

  // These color-ratio warnings are coarse area-estimates with inherent noise, so
  // they are emitted at level 'info' (weighted lower downstream), unlike the
  // robust type-scale `too-many-sizes` signal.
  const warnings = [];
  if (distribution.accent > ACCENT_OVERLOAD) {
    warnings.push({ code: 'accent-overload', level: 'info', detail: `强调色面积偏大(${Math.round(distribution.accent * 100)}%,预算 ~10%),可能稀释重点` });
  }
  // no-dominant: a full-bleed background <rect> (incl. a gradient/url()/image
  // fill that isn't a measurable flat token) IS a dominant background, so the
  // warning would be a false positive — suppress it.
  let caveat = CAVEAT;
  if (distribution.dominant < NO_DOMINANT) {
    if (hasFullBleedBackground) {
      caveat += ' 检测到满版背景形(full-bleed rect,可能为渐变/图片填充),已抑制 no-dominant 警告。';
    } else {
      warnings.push({ code: 'no-dominant', level: 'info', detail: `缺少主导背景色(主导仅 ${Math.round(distribution.dominant * 100)}%,预算 60%),版面可能花乱` });
    }
  }

  return {
    insufficient_area: false,
    hasFullBleedBackground,
    distribution,
    budget,
    deviations,
    warnings,
    caveat,
  };
}

module.exports = { analyzeColorRatio };
