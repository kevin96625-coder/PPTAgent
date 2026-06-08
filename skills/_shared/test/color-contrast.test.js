const test = require('node:test');
const assert = require('node:assert');
const { relLuminance, contrastRatio, adjustToContrast } = require('../scripts/lib/color-contrast');

test('relLuminance black=0, white=1', () => {
  assert.ok(Math.abs(relLuminance('#000000') - 0) < 1e-6);
  assert.ok(Math.abs(relLuminance('#ffffff') - 1) < 1e-6);
});
test('contrastRatio black/white = 21', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.05);
});
test('contrastRatio is order-independent', () => {
  assert.ok(Math.abs(contrastRatio('#6366f1', '#0f172a') - contrastRatio('#0f172a', '#6366f1')) < 1e-9);
});
test('adjustToContrast lightens fill on dark bg until >= target', () => {
  const bg = '#0f172a';
  const out = adjustToContrast('#6366f1', bg, 3, 'lighten');
  assert.ok(contrastRatio(out, bg) >= 3, `got ${contrastRatio(out, bg)}`);
});
test('adjustToContrast no-op when already passing', () => {
  assert.equal(adjustToContrast('#ffffff', '#0f172a', 3, 'lighten').toLowerCase(), '#ffffff');
});
test('adjustToContrast darkens on light bg', () => {
  const bg = '#ffffff';
  const out = adjustToContrast('#cccccc', bg, 4.5, 'darken');
  assert.ok(contrastRatio(out, bg) >= 4.5);
});
