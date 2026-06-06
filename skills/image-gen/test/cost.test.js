const test = require('node:test');
const assert = require('node:assert');
const { estimate, PRICES } = require('../scripts/lib/cost');

test('codex-cli is zero metered cost but flags quota multiplier', () => {
  const r = estimate({ backend: 'codex-cli', count: 10 });
  assert.strictEqual(r.estUsdTotal, 0);
  assert.strictEqual(r.meteredImages, 0);
  assert.match(r.quotaNote, /3-5x|Codex/i);
});

test('gemini-api nano-banana-pro priced per image', () => {
  const r = estimate({ backend: 'gemini-api', model: 'nano-banana-pro', count: 13 });
  assert.strictEqual(r.meteredImages, 13);
  assert.ok(Math.abs(r.estUsdTotal - 13 * PRICES['gemini-api']['nano-banana-pro']) < 1e-9);
});

test('defaults gemini-api model to nano-banana-2', () => {
  const r = estimate({ backend: 'gemini-api', count: 1 });
  assert.ok(Math.abs(r.estUsdTotal - PRICES['gemini-api']['nano-banana-2']) < 1e-9);
});

test('unknown backend throws', () => {
  assert.throws(() => estimate({ backend: 'nope', count: 1 }), /unknown backend/i);
});
