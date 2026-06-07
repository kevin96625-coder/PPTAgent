'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { validateOutline } = require('../scripts/lib/planning-validator');
const targets = require('../references/density-targets.json');

const VALID = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/outline-valid.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const run = (o, opts) => validateOutline(o, Object.assign({ densityTargets: targets, pagesRange: { min: 1, max: 15 } }, opts));

test('clean outline -> ok, no hard errors, no warnings', () => {
  const r = run(VALID);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.hard_errors.length, 0);
  assert.strictEqual(r.warnings.length, 0);
  assert.strictEqual(r.summary.pages, 3);
});

test('hard: missing top-level field', () => {
  const o = clone(VALID); delete o.end_page;
  const r = run(o);
  assert.strictEqual(r.ok, false);
  assert.ok(r.hard_errors.some((e) => e.field === 'end_page'));
});

test('hard: invalid page type enum', () => {
  const o = clone(VALID); o.parts[0].pages[0].type = 'slide';
  assert.ok(run(o).hard_errors.some((e) => e.field === 'type' && /slide/.test(e.msg)));
});

test('hard: invalid end_page.type', () => {
  const o = clone(VALID); o.end_page.type = 'goodbye';
  assert.ok(run(o).hard_errors.some((e) => e.field === 'end_page.type'));
});

test('hard: end_page missing type -> clear message', () => {
  const o = clone(VALID); delete o.end_page.type;
  const r = run(o);
  assert.ok(r.hard_errors.some((e) => e.field === 'end_page.type' && /missing/.test(e.msg)));
});

test('hard: key_points not an array', () => {
  const o = clone(VALID); o.parts[0].pages[0].key_points = 'a, b';
  assert.ok(run(o).hard_errors.some((e) => e.field === 'key_points'));
});

test('hard: missing required page field (title)', () => {
  const o = clone(VALID); delete o.parts[0].pages[1].title;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'title'));
});

test('hard: index not contiguous', () => {
  const o = clone(VALID); o.parts[0].pages[2].index = 5;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'index'));
});

test('hard: total_pages mismatch', () => {
  const o = clone(VALID); o.total_pages = 9;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'total_pages'));
});

test('hard: total_pages outside requested range', () => {
  const o = clone(VALID);
  const r = run(o, { pagesRange: { min: 10, max: 15 } });
  assert.ok(r.hard_errors.some((e) => e.field === 'total_pages' && /range/.test(e.msg)));
});

test('visual_weight invalid is hard, missing is soft', () => {
  const bad = clone(VALID); bad.parts[0].pages[0].visual_weight = 'huge';
  assert.ok(run(bad).hard_errors.some((e) => e.field === 'visual_weight'));
  const miss = clone(VALID); delete miss.parts[0].pages[0].visual_weight;
  const r = run(miss);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'visual_weight'));
});

test('soft: layout missing or unknown -> warn, not block; accepts layout_hint', () => {
  const miss = clone(VALID); delete miss.parts[0].pages[0].layout_type;
  let r = run(miss);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'layout'));
  const unknown = clone(VALID); unknown.parts[0].pages[0].layout_type = 'weird_grid';
  assert.ok(run(unknown).warnings.some((w) => w.kind === 'layout'));
  const hint = clone(VALID); delete hint.parts[0].pages[0].layout_type; hint.parts[0].pages[0].layout_hint = 'two_column_symmetric';
  assert.ok(!run(hint).warnings.some((w) => w.kind === 'layout'), 'layout_hint with valid value should not warn');
});

test('soft density: key_points exceeds max_key_points -> warn', () => {
  const o = clone(VALID); o.parts[0].pages[1].key_points = ['a', 'b', 'c', 'd'];
  const r = run(o);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'density' && /max_key_points/.test(w.msg)));
});

test('soft density: data_elements push info_units over target max+2 -> major', () => {
  const o = clone(VALID);
  o.parts[0].pages[1].data_elements = Array.from({ length: 9 }, (_, i) => ({ type: 'metric', label: 'm' + i }));
  assert.ok(run(o).warnings.some((w) => w.kind === 'density' && w.severity === 'major'));
});

test('soft density: quote page with key_points -> critical', () => {
  const o = clone(VALID); o.parts[0].pages[2].key_points = ['should be empty'];
  assert.ok(run(o).warnings.some((w) => w.kind === 'density' && w.severity === 'critical'));
});

test('soft: >3 consecutive same layout -> diversity warn', () => {
  const o = clone(VALID);
  const p = o.parts[0].pages;
  o.total_pages = 4;
  p.push({ index: 4, title: 'P4', type: 'content', key_points: ['a'], layout_type: 'two_column_symmetric', visual_weight: 'low' });
  p.forEach((pg) => { pg.layout_type = 'two_column_symmetric'; });
  p[2].type = 'content'; p[2].key_points = ['a'];
  assert.ok(run(o).warnings.some((w) => w.kind === 'layout_diversity'));
});

test('soft: >3 consecutive high visual_weight -> rhythm warn', () => {
  const o = clone(VALID);
  const p = o.parts[0].pages;
  o.total_pages = 4;
  p.push({ index: 4, title: 'P4', type: 'content', key_points: ['a'], layout_type: 'hero_grid', visual_weight: 'high' });
  p.forEach((pg) => { pg.visual_weight = 'high'; });
  assert.ok(run(o).warnings.some((w) => w.kind === 'visual_weight_rhythm'));
});

test('soft: part missing key_message -> warn', () => {
  const o = clone(VALID); delete o.parts[0].key_message;
  const r = run(o);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'key_message'));
});

test('robust: null page element -> hard error, no throw', () => {
  const o = clone(VALID); o.parts[0].pages.push(null); o.total_pages = 3;
  let r;
  assert.doesNotThrow(() => { r = run(o); });
  assert.strictEqual(r.ok, false);
  assert.ok(r.hard_errors.some((e) => /pages\[3\]/.test(e.field) || /not an object/.test(e.msg)));
});

test('robust: null part element -> hard error, no throw', () => {
  const o = clone(VALID); o.parts.push(null);
  let r;
  assert.doesNotThrow(() => { r = run(o); });
  assert.strictEqual(r.ok, false);
  assert.ok(r.hard_errors.some((e) => /parts\[1\]/.test(e.field) || /not an object/.test(e.msg)));
});
