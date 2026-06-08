const test = require('node:test');
const assert = require('node:assert');
const { analyzeColorRatio } = require('../scripts/lib/color-ratio');

// A representative scheme + ratio config (mirrors business.yaml P3 blocks).
const SCHEME = {
  primary: '#1a365d',
  secondary: '#2d5f8a',
  accent: '#e67e22',
  background: '#ffffff',
  text: '#1a202c',
  card_bg: '#f0f4f8',
};
const RATIO = {
  dominant: 60,
  secondary: 30,
  accent: 10,
  buckets: {
    dominant: ['background'],
    secondary: ['primary', 'secondary', 'card_bg', 'text'],
    accent: ['accent'],
  },
};
const CANVAS = 1280 * 720; // 921600

test('rect/circle/ellipse areas are computed from geometry', () => {
  // One big background rect covering the canvas so we clear the insufficient-area guard.
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff"/>
    <rect width="100" height="50" fill="#1a365d"/>
    <circle r="10" fill="#2d5f8a"/>
    <ellipse rx="10" ry="5" fill="#f0f4f8"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.ok(!r.insufficient_area, 'background rect clears area guard');
  // dominant area = full canvas; distribution.dominant should be near 1 (>0.9)
  assert.ok(r.distribution.dominant > 0.9, `dominant=${r.distribution.dominant}`);
  assert.ok(typeof r.caveat === 'string' && r.caveat.length > 0);
});

test('fills are bucketed by nearest token; near hex (<48) matches, far hex -> other', () => {
  // #1a365e is 1 unit off #1a365d (primary, secondary bucket). #00ff00 matches nothing -> other.
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff"/>
    <rect width="200" height="200" fill="#1a365e"/>
    <rect width="200" height="200" fill="#00ff00"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  // secondary bucket got the near-match; other got the green and is excluded from the 3-bucket denominator
  assert.ok(r.distribution.secondary > 0, 'near hex bucketed to secondary');
  // green is NOT in dominant/secondary/accent
  const three = r.distribution.dominant + r.distribution.secondary + r.distribution.accent;
  assert.ok(Math.abs(three - 1) < 1e-6, '3 buckets normalize to 1, other excluded');
});

test('large accent area triggers accent-overload', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="700" height="720" fill="#ffffff"/>
    <rect width="580" height="720" fill="#e67e22"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.ok(!r.insufficient_area);
  assert.ok(r.distribution.accent > 0.25, `accent=${r.distribution.accent}`);
  assert.ok(r.warnings.some((w) => w.code === 'accent-overload'));
});

test('chart / unmatched multi-colors go to other and do not pollute the denominator', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff"/>
    <rect width="100" height="100" fill="#8e44ad"/>
    <rect width="100" height="100" fill="#27ae60"/>
    <rect width="100" height="100" fill="#c0392b"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  // dominant (white bg) dominates the 3-bucket denominator; chart colors are in `other`.
  assert.ok(r.distribution.dominant > 0.99, `dominant=${r.distribution.dominant}`);
  assert.ok(r.distribution.other > 0, 'chart colors land in other');
});

test('all-path / image svg => insufficient_area, no color warnings, has caveat', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <path d="M0 0 L100 100 Z" fill="#1a365d"/>
    <image href="photo.jpg" width="1280" height="720"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.equal(r.insufficient_area, true);
  assert.equal(r.warnings.length, 0);
  assert.ok(typeof r.caveat === 'string' && r.caveat.length > 0);
});

test('no-dominant warning when background area is too small (no full-bleed bg)', () => {
  // Big secondary block, tiny background -> dominant share < 0.35.
  // No single rect spans the canvas, so hasFullBleedBackground is false and the
  // warning fires (at level info — color-ratio warnings are estimation-based).
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="640" height="720" fill="#1a365d"/>
    <rect width="500" height="720" fill="#2d5f8a"/>
    <rect width="200" height="200" fill="#ffffff"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.equal(r.hasFullBleedBackground, false);
  assert.ok(r.distribution.dominant < 0.35, `dominant=${r.distribution.dominant}`);
  const nd = r.warnings.find((w) => w.code === 'no-dominant');
  assert.ok(nd, 'no-dominant fires');
  assert.equal(nd.level, 'info', 'color-ratio warnings are info-level (estimation-based)');
});

test('FIX1: gradient full-bleed bg + cards -> hasFullBleedBackground, no no-dominant', () => {
  // Idiomatic background: a full-bleed rect with a gradient url() fill (NOT a
  // measurable flat token) + a couple of secondary cards. The cards alone would
  // measure dominant=0 -> a FALSE no-dominant. The full-bleed bg suppresses it.
  const svg = `<svg viewBox="0 0 1280 720">
    <defs><linearGradient id="grad"><stop stop-color="#1a365d"/><stop stop-color="#2d5f8a"/></linearGradient></defs>
    <rect width="1280" height="720" fill="url(#grad)"/>
    <rect x="80" y="120" width="500" height="480" fill="#f0f4f8"/>
    <rect x="700" y="120" width="500" height="480" fill="#f0f4f8"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.equal(r.hasFullBleedBackground, true);
  assert.ok(!r.warnings.some((w) => w.code === 'no-dominant'), 'no false no-dominant');
  assert.match(r.caveat, /full-bleed|满版/, 'caveat mentions the suppression');
});

test('FIX1: accent-overload still fires with a full-bleed background present', () => {
  // A full-bleed gradient bg does not silence accent-overload (different concern).
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="url(#grad)"/>
    <rect width="700" height="720" fill="#ffffff"/>
    <rect width="580" height="720" fill="#e67e22"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.equal(r.hasFullBleedBackground, true);
  assert.ok(r.warnings.some((w) => w.code === 'accent-overload'), 'accent-overload unaffected');
});

test('FIX3: accent-overload is emitted at level info (estimation-based)', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="700" height="720" fill="#ffffff"/>
    <rect width="580" height="720" fill="#e67e22"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  const ao = r.warnings.find((w) => w.code === 'accent-overload');
  assert.ok(ao);
  assert.equal(ao.level, 'info');
});

// ---- FIX2: ambiguity guard on dark themes ----
const DARK_SCHEME = {
  primary: '#3b82f6',
  secondary: '#60a5fa',
  accent: '#f59e0b',
  background: '#0f172a', // dark page
  text: '#e2e8f0',
  card_bg: '#1e293b',    // dark card, close to background
};
const DARK_RATIO = {
  dominant: 60, secondary: 30, accent: 10,
  buckets: {
    dominant: ['background'],
    secondary: ['primary', 'secondary', 'card_bg', 'text'],
    accent: ['accent'],
  },
};

test('FIX2: exact card_bg on a dark theme -> secondary (unambiguous)', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0f172a"/>
    <rect x="80" y="120" width="1120" height="480" fill="#1e293b"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: DARK_SCHEME, colorRatio: DARK_RATIO });
  assert.ok(r.distribution.secondary > 0, 'exact card_bg lands in secondary');
});

test('FIX2: a color exactly between bg and card_bg -> other (ambiguous, safe)', () => {
  // background #0f172a = (15,23,42); card_bg #1e293b = (30,41,59).
  // Midpoint ≈ (22,32,50) -> #162032.
  const svg = `<svg viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0f172a"/>
    <rect x="80" y="120" width="1120" height="480" fill="#162032"/>
  </svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: DARK_SCHEME, colorRatio: DARK_RATIO });
  // The ambiguous between-color must NOT be guessed into dominant or secondary.
  assert.ok(r.distribution.other > 0, 'ambiguous between-color diverted to other');
});

test('never throws on garbage input; exit-0 contract (no error-level warnings)', () => {
  for (const junk of [null, undefined, 99, '<<<bad', '', '<svg>']) {
    let r;
    assert.doesNotThrow(() => { r = analyzeColorRatio(junk, { colorScheme: SCHEME, colorRatio: RATIO }); });
    assert.ok(Array.isArray(r.warnings));
    assert.ok(!r.warnings.some((w) => w.level === 'error'));
    assert.ok(typeof r.caveat === 'string');
  }
});

test('returns object never contains an svg string', () => {
  const svg = `<svg><rect width="1280" height="720" fill="#ffffff"/></svg>`;
  const r = analyzeColorRatio(svg, { colorScheme: SCHEME, colorRatio: RATIO });
  assert.ok(!('svg' in r));
});
