'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { renderCraftMarkdown } = require('../lib/craft_writer');

function outline() {
  return {
    title: '耶稣喂饱五千人',
    craft: {
      duration_min: 15,
      title: '五饼二鱼手工',
      materials: ['彩色纸', '剪刀', '胶水'],
      steps: ['剪出鱼形', '剪出圆形饼', '粘贴到画面上'],
      relation_to_story: '用手工重温故事，体会神的供应',
    },
    memory_verse: {
      text: '我靠着那加给我力量的，凡事都能做。',
      ref: '腓立比书 4:13',
    },
  };
}

test('renderCraftMarkdown returns a string', () => {
  const md = renderCraftMarkdown(outline());
  assert.strictEqual(typeof md, 'string');
  assert.ok(md.length > 0);
});

test('renderCraftMarkdown includes craft title as a heading', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /五饼二鱼手工/);
});

test('renderCraftMarkdown includes all materials', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /彩色纸/);
  assert.match(md, /剪刀/);
  assert.match(md, /胶水/);
});

test('renderCraftMarkdown includes all steps', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /剪出鱼形/);
  assert.match(md, /剪出圆形饼/);
  assert.match(md, /粘贴到画面上/);
});

test('renderCraftMarkdown includes relation_to_story text', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /体会神的供应/);
});

test('renderCraftMarkdown includes memory verse text and ref', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /我靠着那加给我力量的/);
  assert.match(md, /腓立比书 4:13/);
});

test('renderCraftMarkdown includes duration information', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /15/);
});

test('renderCraftMarkdown uses list format for materials (dash or number)', () => {
  const md = renderCraftMarkdown(outline());
  // Each material should appear after a list marker line
  const lines = md.split('\n');
  const materialLines = lines.filter(l => l.includes('彩色纸') || l.includes('剪刀') || l.includes('胶水'));
  assert.ok(materialLines.length >= 3, 'each material should appear on its own line');
  // at least one has a list marker
  const hasListMarker = materialLines.some(l => /^[-*\d]/.test(l.trim()));
  assert.ok(hasListMarker, 'materials should use list-style formatting');
});

test('renderCraftMarkdown uses list format for steps', () => {
  const md = renderCraftMarkdown(outline());
  const lines = md.split('\n');
  const stepLines = lines.filter(l => l.includes('剪出鱼形'));
  assert.ok(stepLines.length >= 1);
  const hasListMarker = stepLines.some(l => /^[-*\d]/.test(l.trim()));
  assert.ok(hasListMarker, 'steps should use list-style formatting');
});

test('renderCraftMarkdown throws when craft field is missing', () => {
  const obj = outline();
  delete obj.craft;
  assert.throws(() => renderCraftMarkdown(obj), /craft/);
});

test('renderCraftMarkdown throws when memory_verse field is missing', () => {
  const obj = outline();
  delete obj.memory_verse;
  assert.throws(() => renderCraftMarkdown(obj), /memory_verse/);
});

test('renderCraftMarkdown handles multiple materials and steps (boundary: 5 items)', () => {
  const obj = outline();
  obj.craft.materials = ['纸', '笔', '剪刀', '胶水', '彩带'];
  obj.craft.steps = ['步骤一', '步骤二', '步骤三', '步骤四', '步骤五'];
  const md = renderCraftMarkdown(obj);
  for (const m of obj.craft.materials) assert.match(md, new RegExp(m));
  for (const s of obj.craft.steps) assert.match(md, new RegExp(s));
});
