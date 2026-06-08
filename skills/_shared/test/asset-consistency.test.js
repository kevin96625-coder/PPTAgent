'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { planReferences, normalizeQuery } = require('../scripts/lib/asset-consistency');

function outlineOf(pages) {
  return { parts: [{ pages }] };
}

test('same subject across multiple scene pages -> one group, master = smallest page', () => {
  const o = outlineOf([
    { index: 3, asset: { needed: true, kind: 'scene', subject: 'david', query: 'a' } },
    { index: 8, asset: { needed: true, kind: 'scene', subject: 'david', query: 'b' } },
    { index: 5, asset: { needed: true, kind: 'scene', subject: 'david', query: 'c' } },
  ]);
  const r = planReferences(o);
  assert.equal(r.groups.length, 1);
  const g = r.groups[0];
  assert.equal(g.subject, 'david');
  assert.equal(g.master_page, 3);
  assert.deepEqual(g.derived_pages, [5, 8]);
  assert.equal(g.kind, 'scene');
  assert.equal(r.singletons.length, 0);
});

test('same normalized query (no subject) -> grouped', () => {
  const o = outlineOf([
    { index: 2, asset: { needed: true, kind: 'scene', query: '牧羊少年大卫，站在旷野' } },
    { index: 4, asset: { needed: true, kind: 'scene', query: '牧羊少年大卫 站在旷野!' } },
  ]);
  const r = planReferences(o);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].master_page, 2);
  assert.deepEqual(r.groups[0].derived_pages, [4]);
});

test('brand-entity same subject across pages -> grouped but kind brand-entity', () => {
  const o = outlineOf([
    { index: 1, asset: { needed: true, kind: 'brand-entity', subject: 'su7', query: 'SU7 官方图' } },
    { index: 6, asset: { needed: true, kind: 'brand-entity', subject: 'su7', query: 'SU7 侧面' } },
  ]);
  const r = planReferences(o);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].kind, 'brand-entity');
  assert.equal(r.groups[0].master_page, 1);
  assert.deepEqual(r.groups[0].derived_pages, [6]);
});

test('single-subject page -> singleton, not a group', () => {
  const o = outlineOf([
    { index: 2, asset: { needed: true, kind: 'scene', subject: 'lonely', query: 'x' } },
    { index: 3, asset: { needed: true, kind: 'brand-entity', subject: 'only-brand', query: 'y' } },
  ]);
  const r = planReferences(o);
  assert.equal(r.groups.length, 0);
  assert.equal(r.singletons.length, 2);
  assert.deepEqual(r.singletons.map((s) => s.page).sort((a, b) => a - b), [2, 3]);
  const s2 = r.singletons.find((s) => s.page === 2);
  assert.equal(s2.kind, 'scene');
});

test('empty / missing asset / needed=false -> never throws, no groups', () => {
  assert.doesNotThrow(() => planReferences(undefined));
  assert.doesNotThrow(() => planReferences({}));
  assert.doesNotThrow(() => planReferences({ parts: null }));
  const o = outlineOf([
    { index: 1 },
    { index: 2, asset: { needed: false, kind: 'none' } },
    { index: 3, asset: null },
    { index: 4, asset: { needed: true, kind: 'none' } },
    null,
  ]);
  const r = planReferences(o);
  assert.equal(r.groups.length, 0);
  assert.equal(r.singletons.length, 0);
});

test('garbage fields degrade gracefully (no throw)', () => {
  const o = { parts: [{ pages: [{ index: 'oops', asset: { needed: true, kind: 'scene', query: 123 } }] }] };
  let r;
  assert.doesNotThrow(() => { r = planReferences(o); });
  assert.ok(Array.isArray(r.groups));
  assert.ok(Array.isArray(r.singletons));
});

test('normalizeQuery strips punctuation/whitespace and lowercases', () => {
  assert.equal(normalizeQuery('  Hello, World! '), normalizeQuery('helloworld'));
});
