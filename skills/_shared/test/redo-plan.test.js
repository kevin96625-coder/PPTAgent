'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { planRedo } = require('../scripts/lib/redo-plan');

function manifestOf(entries) {
  return { images: entries };
}

test('scene page with assetScore < 6 and redo_count < cap -> redo (round = redo_count+1)', () => {
  const review = [{ page: 5, assetScore: 4, kind: 'scene', reason: 'blurry face' }];
  const m = manifestOf([{ page: 5, kind: 'scene', status: 'generated', redo_count: 0, reference_of: 3 }]);
  const r = planRedo(review, m);
  assert.equal(r.redo.length, 1);
  assert.equal(r.redo[0].page, 5);
  assert.equal(r.redo[0].round, 1);
  assert.equal(r.redo[0].kind, 'scene');
  assert.equal(r.redo[0].reference_of, 3);
  assert.match(r.redo[0].reason, /blurry/);
  assert.equal(r.reshoot.length, 0);
  assert.equal(r.exhausted.length, 0);
});

test('brand-entity low score -> reshoot, never redo', () => {
  const review = [{ page: 2, assetScore: 3, kind: 'brand-entity', reason: 'wrong product' }];
  const m = manifestOf([{ page: 2, kind: 'brand-entity', status: 'fetched', redo_count: 0 }]);
  const r = planRedo(review, m);
  assert.equal(r.redo.length, 0);
  assert.equal(r.reshoot.length, 1);
  assert.equal(r.reshoot[0].page, 2);
  assert.equal(r.reshoot[0].kind, 'brand-entity');
});

test('scene with redo_count >= cap -> exhausted, keep placeholder', () => {
  const review = [{ page: 8, assetScore: 2, kind: 'scene', reason: 'still bad' }];
  const m = manifestOf([{ page: 8, kind: 'scene', status: 'generated', redo_count: 2 }]);
  const r = planRedo(review, m, { cap: 2 });
  assert.equal(r.redo.length, 0);
  assert.equal(r.exhausted.length, 1);
  assert.equal(r.exhausted[0].page, 8);
  assert.match(r.exhausted[0].reason, /redo cap reached -> keep placeholder/);
});

test('score >= 6 -> untouched (no redo/reshoot/exhausted)', () => {
  const review = [{ page: 4, assetScore: 8, kind: 'scene', reason: '' }];
  const m = manifestOf([{ page: 4, kind: 'scene', status: 'generated', redo_count: 0 }]);
  const r = planRedo(review, m);
  assert.equal(r.redo.length, 0);
  assert.equal(r.reshoot.length, 0);
  assert.equal(r.exhausted.length, 0);
});

test('missing fields / garbage input -> skip page, never throws', () => {
  assert.doesNotThrow(() => planRedo(undefined, undefined));
  assert.doesNotThrow(() => planRedo(null, null));
  const review = [
    { page: 5 },                              // no assetScore -> skip
    { assetScore: 1, kind: 'scene' },         // no page -> skip
    null,
    { page: 9, assetScore: 3, kind: 'scene' }, // no manifest entry -> skip
  ];
  const m = manifestOf([{ page: 5, kind: 'scene', status: 'generated' }]);
  let r;
  assert.doesNotThrow(() => { r = planRedo(review, m); });
  assert.equal(r.redo.length, 0);
  assert.equal(r.exhausted.length, 0);
});

test('reference_of is passed through to redo entry', () => {
  const review = [{ page: 7, assetScore: 5, kind: 'scene', reason: 'r' }];
  const m = manifestOf([{ page: 7, kind: 'scene', status: 'generated', redo_count: 1, reference_of: 3 }]);
  const r = planRedo(review, m);
  assert.equal(r.redo.length, 1);
  assert.equal(r.redo[0].reference_of, 3);
  assert.equal(r.redo[0].round, 2);
});
