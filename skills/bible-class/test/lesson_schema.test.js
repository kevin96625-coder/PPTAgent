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

const { validateLessonOutline } = require('../lib/lesson_schema');

// ── helpers ───────────────────────────────────────────────────────────────────

function validOutline() {
  return {
    title: '耶稣喂饱五千人',
    approved: false,
    scripture_ref: '约翰福音 6:1-15',
    teaching: {
      duration_min: 15,
      scenes: [
        {
          index: 1,
          title: '小男孩带来午餐',
          key_message: '神能用小的东西做大事',
          narration: '有一天，一个小男孩带来了五个饼和两条鱼……',
          interaction: '你有没有带过零食分享给朋友？',
          image_brief: '小男孩微笑着将篮子递给耶稣，周围有很多小朋友',
        },
      ],
    },
    craft: {
      duration_min: 15,
      title: '五饼二鱼手工',
      materials: ['彩色纸', '剪刀', '胶水'],
      steps: ['剪出鱼形', '剪出圆形饼', '粘贴到画面'],
      relation_to_story: '用手工重温故事，体会神的供应',
    },
    memory_verse: {
      text: '耶稣说：你们来，你们自己暗暗地到旷野地方去歇一歇。',
      ref: '马可福音 6:31',
    },
  };
}

// ── validateLessonOutline ─────────────────────────────────────────────────────

test('validateLessonOutline: valid object returns ok=true with no errors', () => {
  const r = validateLessonOutline(validOutline());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('validateLessonOutline: missing title fails', () => {
  const obj = validOutline();
  delete obj.title;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title')));
});

test('validateLessonOutline: missing scripture_ref fails', () => {
  const obj = validOutline();
  delete obj.scripture_ref;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scripture_ref')));
});

test('validateLessonOutline: approved not a boolean fails', () => {
  const obj = validOutline();
  obj.approved = 'yes';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('approved') && e.includes('boolean')));
});

test('validateLessonOutline: approved missing fails', () => {
  const obj = validOutline();
  delete obj.approved;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('approved')));
});

test('validateLessonOutline: missing teaching block fails', () => {
  const obj = validOutline();
  delete obj.teaching;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('teaching')));
});

test('validateLessonOutline: empty scenes array fails', () => {
  const obj = validOutline();
  obj.teaching.scenes = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scenes') && e.includes('at least one')));
});

test('validateLessonOutline: scenes not an array fails', () => {
  const obj = validOutline();
  obj.teaching.scenes = 'not-array';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scenes') && e.includes('array')));
});

test('validateLessonOutline: scene missing image_brief fails', () => {
  const obj = validOutline();
  delete obj.teaching.scenes[0].image_brief;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('image_brief')));
});

test('validateLessonOutline: scene missing narration fails', () => {
  const obj = validOutline();
  delete obj.teaching.scenes[0].narration;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('narration')));
});

test('validateLessonOutline: scene index not a number fails', () => {
  const obj = validOutline();
  obj.teaching.scenes[0].index = '1';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('index') && e.includes('number')));
});

test('validateLessonOutline: missing craft block fails', () => {
  const obj = validOutline();
  delete obj.craft;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('craft')));
});

test('validateLessonOutline: craft with empty materials fails', () => {
  const obj = validOutline();
  obj.craft.materials = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('materials')));
});

test('validateLessonOutline: craft with empty steps fails', () => {
  const obj = validOutline();
  obj.craft.steps = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('steps')));
});

test('validateLessonOutline: missing memory_verse fails', () => {
  const obj = validOutline();
  delete obj.memory_verse;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('memory_verse')));
});

test('validateLessonOutline: memory_verse missing ref fails', () => {
  const obj = validOutline();
  delete obj.memory_verse.ref;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('memory_verse') && e.includes('ref')));
});

test('validateLessonOutline: null input fails gracefully', () => {
  const r = validateLessonOutline(null);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateLessonOutline: approved=true is valid (lead sets this after approval)', () => {
  const obj = validOutline();
  obj.approved = true;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, true);
});
