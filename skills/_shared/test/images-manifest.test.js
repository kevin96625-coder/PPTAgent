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

// --- P6: cross-reference fields reference_of / seed / redo_count ---

test('makeEntry passes through reference_of / seed / redo_count', () => {
  const e = makeEntry({ page: 5, kind: 'scene', path: 'images/s.png', reference_of: 3, seed: 12345, redo_count: 1 });
  assert.equal(e.reference_of, 3);
  assert.equal(e.seed, 12345);
  assert.equal(e.redo_count, 1);
});

test('makeEntry defaults redo_count to 0 when absent', () => {
  const e = makeEntry({ page: 2, kind: 'scene', path: 'images/s.png' });
  assert.equal(e.redo_count, 0);
});

test('validateManifest accepts entry with new numeric fields', () => {
  const r = validateManifest({ images: [makeEntry({ page: 5, kind: 'scene', path: 'images/s.png', reference_of: 3, seed: 7, redo_count: 2 })] });
  assert.equal(r.ok, true);
});

test('validateManifest backward compat: old entry without new fields is valid', () => {
  const r = validateManifest({ images: [{ page: 1, kind: 'scene', status: 'generated', path: 'images/s.png' }] });
  assert.equal(r.ok, true);
});

test('validateManifest rejects wrong-typed reference_of / seed / redo_count', () => {
  const bad1 = validateManifest({ images: [{ page: 1, kind: 'scene', status: 'generated', path: 'p.png', reference_of: 'x' }] });
  assert.equal(bad1.ok, false);
  const bad2 = validateManifest({ images: [{ page: 1, kind: 'scene', status: 'generated', path: 'p.png', seed: 'nope' }] });
  assert.equal(bad2.ok, false);
  const bad3 = validateManifest({ images: [{ page: 1, kind: 'scene', status: 'generated', path: 'p.png', redo_count: '2' }] });
  assert.equal(bad3.ok, false);
});

test('IMAGE_STATUSES vocabulary', () => {
  assert.deepEqual([...IMAGE_STATUSES].sort(), ['fetched', 'generated', 'missing']);
});
