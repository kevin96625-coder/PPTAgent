const test = require('node:test');
const assert = require('node:assert');
const { assetPlan } = require('../scripts/lib/asset-plan');

// nested parts[].pages[] shape (matches real outlines + validator's collectPages)
const outline = { parts: [{ pages: [
  { index: 1, type: 'image', asset: { needed: true, kind: 'brand-entity', query: 'x' } },
  { index: 2, type: 'data', asset: { needed: false, kind: 'none' } },
  { index: 3, type: 'image', asset: { needed: true, kind: 'scene', query: 'y' } },
  { index: 4, type: 'content' }, // no asset object
] }] };

test('assetPlan lists pages needing assets', () => {
  const p = assetPlan(outline, { images: [] });
  assert.deepEqual(p.asset_pages.map((x) => x.page).sort(), [1, 3]);
});

test('assetPlan flags needs_real_image when manifest missing for brand-entity', () => {
  const p = assetPlan(outline, { images: [{ page: 1, kind: 'brand-entity', status: 'missing' }] });
  assert.ok(p.needs_real_image.includes(1));
});

test('assetPlan does not flag when image fetched', () => {
  const p = assetPlan(outline, { images: [{ page: 1, kind: 'brand-entity', status: 'fetched', path: 'images/s.jpg' }] });
  assert.ok(!p.needs_real_image.includes(1));
});

test('assetPlan treats absent manifest entry as needing image', () => {
  const p = assetPlan(outline, { images: [] });
  assert.ok(p.needs_real_image.includes(1) && p.needs_real_image.includes(3));
});
