const test = require('node:test');
const assert = require('node:assert');
const { analyzeTypeScale } = require('../scripts/lib/type-scale');

// Canonical P3 ladder (base px @ scale 1.0).
const LADDER = { h1: 64, h2: 40, h3: 28, body: 18, label: 15, caption: 14, micro: 12 };

test('distinctSizes counts unique font-size values', () => {
  const svg = `<svg viewBox="0 0 1280 720">
    <text font-size="64">A</text>
    <text font-size="40">B</text>
    <text font-size="18">C</text>
    <text font-size="18">D</text>
  </svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.0 });
  assert.equal(r.distinctSizes, 3);
  assert.deepEqual(r.sizes, [18, 40, 64]);
  assert.ok(!r.warnings.some((w) => w.code === 'too-many-sizes'));
});

test('more than 6 distinct sizes triggers too-many-sizes', () => {
  const sizes = [64, 40, 28, 18, 15, 22, 33];
  const svg = `<svg>${sizes.map((s) => `<text font-size="${s}">x</text>`).join('')}</svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.0 });
  assert.equal(r.distinctSizes, 7);
  assert.ok(r.warnings.some((w) => w.code === 'too-many-sizes'));
});

test('sizes on the ladder (times scale) produce no off-ladder entries', () => {
  // effectiveScale 1.3 => ladder rungs become 64*1.3=83.2, 40*1.3=52, 28*1.3=36.4 ...
  const svg = `<svg>
    <text font-size="83">A</text>
    <text font-size="52">B</text>
    <text font-size="36">C</text>
  </svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.3 });
  assert.equal(r.offLadder.length, 0);
  assert.ok(!r.warnings.some((w) => w.code === 'off-ladder'));
});

test('a size far from any rung is recorded in offLadder', () => {
  // effectiveScale 1.0; 90 is ~41% above the top rung (64) -> off-ladder (>25% from nearest).
  const svg = `<svg><text font-size="90">x</text><text font-size="18">y</text></svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.0 });
  assert.ok(r.offLadder.some((o) => o.size === 90));
  assert.ok(r.warnings.some((w) => w.code === 'off-ladder'));
  // 18 is exactly on the body rung -> not off-ladder.
  assert.ok(!r.offLadder.some((o) => o.size === 18));
});

test('micro (<14) and data-decorative text are skipped for off-ladder', () => {
  // 9px would be wildly off-ladder, but it is <14 -> skipped. Decorative 50px skipped too.
  const svg = `<svg>
    <text font-size="9">tiny</text>
    <text data-decorative="true" font-size="50">deco</text>
    <text font-size="40">ok</text>
  </svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.0 });
  assert.ok(!r.offLadder.some((o) => o.size === 9));
  assert.ok(!r.offLadder.some((o) => o.size === 50));
  // decorative size not counted in distinctSizes either
  assert.ok(!r.sizes.includes(50));
});

test('never throws on garbage input; returns empty-ish analysis', () => {
  for (const junk of [null, undefined, 42, '<<<not svg', '', '<svg font-size="oops">']) {
    let r;
    assert.doesNotThrow(() => { r = analyzeTypeScale(junk, { ladder: LADDER }); });
    assert.ok(Array.isArray(r.warnings));
    // no warning is ever a hard error
    assert.ok(!r.warnings.some((w) => w.level === 'error'));
  }
});

test('effectiveScale absent => off-ladder flagged best-effort', () => {
  const svg = `<svg><text font-size="90">x</text></svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER });
  // best-effort: entries may exist but flagged; warning (if any) is informational, not error
  assert.ok(r.offLadder.every((o) => o.bestEffort === true));
  assert.ok(!r.warnings.some((w) => w.level === 'error'));
});

test('returns object never contains an svg string', () => {
  const svg = `<svg><text font-size="40">x</text></svg>`;
  const r = analyzeTypeScale(svg, { ladder: LADDER, effectiveScale: 1.0 });
  assert.ok(!('svg' in r));
});
