'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateLessonSource } = require('../lib/lesson_schema');

// ── helpers ──────────────────────────────────────────────────────────────────

function validSource() {
  return {
    title: '耶稣喂饱五千人',
    scripture_ref: '约翰福音 6:1-15',
    material_name: '儿童圣经故事教材',
    age_group: '3-5',
    core_points: ['神的供应', '感恩祷告'],
    raw_text: '今天的故事是耶稣用五饼二鱼喂饱了五千人……',
    source_kind: 'image',
  };
}

// ── validateLessonSource ──────────────────────────────────────────────────────

test('validateLessonSource: valid object returns ok=true with no errors', () => {
  const r = validateLessonSource(validSource());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('validateLessonSource: missing title fails with clear error', () => {
  const obj = validSource();
  delete obj.title;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title')), `errors should mention "title": ${r.errors}`);
});

test('validateLessonSource: missing scripture_ref fails', () => {
  const obj = validSource();
  delete obj.scripture_ref;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scripture_ref')));
});

test('validateLessonSource: missing material_name fails', () => {
  const obj = validSource();
  delete obj.material_name;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('material_name')));
});

test('validateLessonSource: missing age_group fails', () => {
  const obj = validSource();
  delete obj.age_group;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('age_group')));
});

test('validateLessonSource: missing core_points fails', () => {
  const obj = validSource();
  delete obj.core_points;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points')));
});

test('validateLessonSource: missing raw_text fails', () => {
  const obj = validSource();
  delete obj.raw_text;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('raw_text')));
});

test('validateLessonSource: missing source_kind fails', () => {
  const obj = validSource();
  delete obj.source_kind;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('source_kind')));
});

test('validateLessonSource: invalid source_kind value fails', () => {
  const obj = validSource();
  obj.source_kind = 'video';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('source_kind') && (e.includes('image') || e.includes('text'))));
});

test('validateLessonSource: core_points not an array fails', () => {
  const obj = validSource();
  obj.core_points = '神的供应';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points') && e.includes('array')));
});

test('validateLessonSource: core_points empty array fails', () => {
  const obj = validSource();
  obj.core_points = [];
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points')));
});

test('validateLessonSource: title not a string fails', () => {
  const obj = validSource();
  obj.title = 42;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title') && e.includes('string')));
});

test('validateLessonSource: null input fails gracefully', () => {
  const r = validateLessonSource(null);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateLessonSource: source_kind=text is valid', () => {
  const obj = validSource();
  obj.source_kind = 'text';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, true);
});
