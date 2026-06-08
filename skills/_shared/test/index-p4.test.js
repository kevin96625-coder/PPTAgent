'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SHARED = path.join(__dirname, '..');
const INDEX = JSON.parse(fs.readFileSync(path.join(SHARED, 'index.json'), 'utf8'));

// index.json has a mixed base: prompt/style/reference entries are relative to
// references/, while assets/ entries are relative to _shared/. Resolve a
// file_path by trying both known bases.
function resolveEntry(file_path) {
  for (const base of [path.join(SHARED, 'references'), SHARED]) {
    const fp = path.join(base, file_path);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

const P4_IDS = [
  'principle-failure-modes',
  'principle-color-psychology',
  'reference-design-cheatsheet',
  'block-blocks',
  'chart-charts-catalog',
  'craft-layout-craft',
];

test('all P4 reference entries are registered in index.json', () => {
  for (const id of P4_IDS) {
    const entry = INDEX.resources.find((r) => r.id === id);
    assert.ok(entry, `index.json must register ${id}`);
  }
});

test('each P4 entry file_path resolves to a real existing file', () => {
  for (const id of P4_IDS) {
    const entry = INDEX.resources.find((r) => r.id === id);
    assert.ok(resolveEntry(entry.file_path), `file must exist for ${id}: ${entry.file_path}`);
  }
});

test('each P4 entry has domain/name/keywords/description/use_cases (schema parity)', () => {
  const domains = new Set(['principle', 'block', 'chart', 'craft']);
  for (const id of P4_IDS) {
    const e = INDEX.resources.find((r) => r.id === id);
    assert.ok(domains.has(e.domain), `${id} domain should be one of principle/block/chart/craft, got ${e.domain}`);
    assert.ok(typeof e.name === 'string' && e.name.length, `${id} has name`);
    assert.ok(Array.isArray(e.keywords) && e.keywords.length, `${id} has keywords`);
    assert.ok(typeof e.description === 'string' && e.description.length, `${id} has description`);
    assert.ok(Array.isArray(e.use_cases) && e.use_cases.length, `${id} has use_cases`);
  }
});

test('total_count reflects the new P4 domains', () => {
  const tc = INDEX.total_count;
  assert.strictEqual(tc.principles, 2);
  assert.strictEqual(tc.blocks, 1);
  assert.strictEqual(tc.charts, 1);
  assert.strictEqual(tc.craft, 1);
});

test('every resource file_path in the index exists (no dangling entries)', () => {
  for (const r of INDEX.resources) {
    assert.ok(resolveEntry(r.file_path), `dangling index entry: ${r.id} → ${r.file_path}`);
  }
});
