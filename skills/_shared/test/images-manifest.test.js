const test = require('node:test');
const assert = require('node:assert');
const { makeEntry, validateManifest, IMAGE_STATUSES } = require('../scripts/lib/images-manifest');

test('makeEntry defaults status to missing', () => {
  const e = makeEntry({ page: 3, kind: 'brand-entity' });
  assert.equal(e.status, 'missing');
  assert.equal(e.page, 3);
});

test('makeEntry with path is fetched', () => {
  const e = makeEntry({ page: 1, kind: 'brand-entity', path: 'images/slide-01.jpg', source_url: 'http://x/y.jpg' });
  assert.equal(e.status, 'fetched');
});

test('makeEntry scene with path is generated', () => {
  const e = makeEntry({ page: 2, kind: 'scene', path: 'images/slide-02.png', backend: 'image-gen' });
  assert.equal(e.status, 'generated');
});

test('validateManifest rejects unknown status', () => {
  const r = validateManifest({ images: [{ page: 1, kind: 'scene', status: 'bogus' }] });
  assert.equal(r.ok, false);
});

test('validateManifest accepts well-formed manifest', () => {
  const r = validateManifest({ images: [makeEntry({ page: 1, kind: 'scene', path: 'images/s.png', backend: 'image-gen' })] });
  assert.equal(r.ok, true);
});

test('validateManifest guards malformed (null) entries without throwing', () => {
  const r = validateManifest({ images: [null] });
  assert.equal(r.ok, false);
});

test('IMAGE_STATUSES vocabulary', () => {
  assert.deepEqual([...IMAGE_STATUSES].sort(), ['fetched', 'generated', 'missing']);
});
