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
  assert.strictEqual(tc.craft, 2);
});

// total_count keys are pluralized aliases of the resource `domain` field
// (prompt→prompts, style→styles, asset→assets, principle→principles,
// block→blocks, chart→charts, craft→craft). For EVERY total_count key, the
// declared count must equal the actual number of resources with that domain —
// computed from resources[] so the count can never silently drift again.
test('total_count for every domain equals the actual resource count (no drift)', () => {
  // Derive the singular domain for a total_count key by matching it against the
  // distinct domains present in resources[] (key === domain or key === domain+'s').
  const actualByDomain = {};
  for (const r of INDEX.resources) {
    actualByDomain[r.domain] = (actualByDomain[r.domain] || 0) + 1;
  }
  for (const [key, declared] of Object.entries(INDEX.total_count)) {
    const domain = actualByDomain[key] != null
      ? key
      : (key.endsWith('s') && actualByDomain[key.slice(0, -1)] != null ? key.slice(0, -1) : null);
    assert.ok(domain != null, `total_count key "${key}" maps to no resource domain`);
    assert.strictEqual(
      declared,
      actualByDomain[domain],
      `total_count.${key} (${declared}) != resources with domain "${domain}" (${actualByDomain[domain]})`
    );
  }
  // And the reverse: every domain present in resources[] is declared in total_count.
  for (const domain of Object.keys(actualByDomain)) {
    const present = domain in INDEX.total_count || (`${domain}s`) in INDEX.total_count;
    assert.ok(present, `domain "${domain}" has resources but no total_count entry`);
  }
});

test('no duplicate resource ids', () => {
  const ids = INDEX.resources.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'resource ids must be unique');
});

test('every resource file_path in the index exists (no dangling entries)', () => {
  for (const r of INDEX.resources) {
    assert.ok(resolveEntry(r.file_path), `dangling index entry: ${r.id} → ${r.file_path}`);
  }
});
