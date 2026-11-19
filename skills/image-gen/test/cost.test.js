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

test('gemini-fetch prices gemini-3.1-flash-image per image', () => {
  const r = estimate({ backend: 'gemini-fetch', model: 'gemini-3.1-flash-image', count: 8 });
  assert.strictEqual(r.meteredImages, 8);
  assert.ok(Math.abs(r.estUsdTotal - 8 * PRICES['gemini-fetch']['gemini-3.1-flash-image']) < 1e-9);
});

test('openai-fetch prices both gpt-image-2.5 tiers', () => {
  for (const m of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
    const r = estimate({ backend: 'openai-fetch', model: m, count: 2 });
    assert.ok(Math.abs(r.estUsdTotal - 2 * PRICES['openai-fetch'][m]) < 1e-9, m);
  }
});

test('agy-cli is zero metered cost and echoes the requested model', () => {
  const r = estimate({ backend: 'agy-cli', model: 'gemini-3.1-flash-image', count: 7 });
  assert.strictEqual(r.estUsdTotal, 0);
  assert.strictEqual(r.meteredImages, 0);
  assert.strictEqual(r.model, 'gemini-3.1-flash-image');
  assert.match(r.quotaNote, /subscription/);
});

test('codex-cli estimate echoes the requested image model', () => {
  const r = estimate({ backend: 'codex-cli', model: 'gpt-image-2.5-flare', count: 1 });
  assert.strictEqual(r.estUsdTotal, 0);
  assert.strictEqual(r.model, 'gpt-image-2.5-flare');
});
