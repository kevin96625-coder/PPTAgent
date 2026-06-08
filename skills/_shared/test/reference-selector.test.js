'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { selectReferences } = require('../scripts/lib/reference-selector');

const REAL_INDEX = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8')
);

test('case 1: data page (chart/metric data_elements) → charts-catalog + design-cheatsheet', () => {
  const { ids, reason } = selectReferences(
    { type: 'data', layout_type: 'dashboard', data_elements: [{ type: 'chart' }, { type: 'metric' }], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(ids.includes('chart-charts-catalog'), 'expected charts catalog');
  assert.ok(ids.includes('reference-design-cheatsheet'), 'expected design cheatsheet');
  assert.ok(Array.isArray(reason) && reason.length === ids.length, 'reason per id');
});

test('case 2: cover slide (--type cover) → layout-craft', () => {
  const { ids } = selectReferences(
    { type: 'cover', layout_type: 'full_bleed', data_elements: [], has_asset: true },
    { index: REAL_INDEX }
  );
  assert.ok(ids.includes('craft-layout-craft'), 'cover should pull layout-craft');
});

test('case 2b: end slide (--type end) → layout-craft', () => {
  const { ids } = selectReferences(
    { type: 'end', layout_type: 'single_focus', data_elements: [], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(ids.includes('craft-layout-craft'), 'end slide should pull layout-craft');
});

test('case 2c: body page with a hero-ish layout_type → layout-craft', () => {
  for (const layout_type of ['single_focus', 'hero_grid', 'full_bleed']) {
    const { ids } = selectReferences(
      { type: 'content', layout_type, data_elements: [], has_asset: false },
      { index: REAL_INDEX }
    );
    assert.ok(
      ids.includes('craft-layout-craft'),
      `body content page with layout_type=${layout_type} should pull layout-craft`
    );
  }
});

test('case 2d: body page with a non-hero layout_type does NOT pull layout-craft', () => {
  const { ids } = selectReferences(
    { type: 'content', layout_type: 'two_column_symmetric', data_elements: [], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(!ids.includes('craft-layout-craft'), 'plain two-column content page should not pull layout-craft');
});

test('case 2e: removed routing — "section" type and "timeline" type are NOT real page types', () => {
  // `section` was never a real pages[].type, and `timeline` is a layout_type, not
  // a page type. Neither should trigger any page-type-specific reference on its own
  // (a bare `section` type with a plain layout pulls nothing but optional color).
  const section = selectReferences(
    { type: 'section', layout_type: 'two_column_symmetric', data_elements: [], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(!section.ids.includes('craft-layout-craft'), 'bogus "section" type must not route to layout-craft');

  // `timeline` as a page TYPE must not route to blocks (only process/comparison do).
  const timelineType = selectReferences(
    { type: 'timeline', layout_type: 'two_column_symmetric', data_elements: [], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(!timelineType.ids.includes('block-blocks'), 'bogus "timeline" page type must not route to blocks');
});

test('case 3: comparison page → blocks', () => {
  const { ids } = selectReferences(
    { type: 'comparison', layout_type: 'two_column_symmetric', data_elements: [], has_asset: false },
    { index: REAL_INDEX }
  );
  assert.ok(ids.includes('block-blocks'), 'comparison should pull blocks');
});

test('case 4: caps to cap (default 4, and explicit cap=2)', () => {
  // A data page that triggers many refs (chart+metric data, plus asset color hint etc.)
  const opts = { type: 'data', layout_type: 'dashboard', data_elements: [{ type: 'chart' }], has_asset: true };
  const full = selectReferences(opts, { index: REAL_INDEX });
  assert.ok(full.ids.length <= 4, `default cap 4, got ${full.ids.length}`);
  const capped = selectReferences(opts, { index: REAL_INDEX, cap: 2 });
  assert.ok(capped.ids.length <= 2, `cap 2, got ${capped.ids.length}`);
});

test('case 5: missing / garbage index → empty ids, no throw', () => {
  assert.doesNotThrow(() => {
    const a = selectReferences({ type: 'data', data_elements: [] }, { index: undefined });
    assert.deepStrictEqual(a.ids, []);
    assert.ok(a.reason.length >= 1);

    const b = selectReferences({ type: 'data', data_elements: [] }, { index: { not: 'resources' } });
    assert.deepStrictEqual(b.ids, []);

    const c = selectReferences({ type: 'data', data_elements: [] }, {});
    assert.deepStrictEqual(c.ids, []);

    const d = selectReferences(null, { index: REAL_INDEX });
    assert.ok(Array.isArray(d.ids));
  });
});

test('case 6: dedupe + stable sort (deterministic, no duplicate ids)', () => {
  const opts = { type: 'data', layout_type: 'dashboard', data_elements: [{ type: 'chart' }, { type: 'metric' }, { type: 'chart' }], has_asset: false };
  const r1 = selectReferences(opts, { index: REAL_INDEX });
  const r2 = selectReferences(opts, { index: REAL_INDEX });
  // no duplicates
  assert.strictEqual(new Set(r1.ids).size, r1.ids.length, 'no duplicate ids');
  // stable / deterministic across calls
  assert.deepStrictEqual(r1.ids, r2.ids, 'deterministic ordering');
});

test('every selected id resolves to a real index entry with an existing file', () => {
  const { ids } = selectReferences(
    { type: 'data', layout_type: 'timeline', data_elements: [{ type: 'chart' }], has_asset: false },
    { index: REAL_INDEX }
  );
  for (const id of ids) {
    const entry = REAL_INDEX.resources.find((r) => r.id === id);
    assert.ok(entry, `id ${id} must exist in index`);
    // P4 reference entries are relative to references/
    const fp = path.join(__dirname, '..', 'references', entry.file_path);
    assert.ok(fs.existsSync(fp), `file for ${id} must exist: ${entry.file_path}`);
  }
});
