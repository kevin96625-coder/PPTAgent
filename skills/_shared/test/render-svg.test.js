const test = require('node:test');
const assert = require('node:assert');
const { findChrome, buildRenderArgs } = require('../scripts/lib/render-svg');

test('buildRenderArgs produces headless screenshot args at 1280x720', () => {
  const args = buildRenderArgs('/in/slide.svg', '/out/slide.png');
  assert.ok(args.includes('--headless'));
  assert.ok(args.some((a) => a.startsWith('--screenshot=')));
  assert.ok(args.includes('--window-size=1280,720'));
  assert.ok(args.some((a) => a.startsWith('file://') && a.endsWith('slide.svg')));
});

test('buildRenderArgs screenshot path matches out', () => {
  const args = buildRenderArgs('/in/a.svg', '/out/a.png');
  assert.ok(args.includes('--screenshot=/out/a.png'));
});

test('findChrome returns a string path or null (no throw)', () => {
  const c = findChrome();
  assert.ok(c === null || typeof c === 'string');
});
