'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const FAILURE = read('../references/principles/failure-modes.md');
const CHEATSHEET = read('../references/design-cheatsheet.md');
const BLOCKS = read('../references/blocks.md');
const CHARTS = read('../references/charts-catalog.md');
const COLOR = read('../references/color-psychology.md');
const LAYOUT = read('../references/layout-craft.md');
const ATTRIB = read('../../../ATTRIBUTIONS.md');

const SLIDE = read('../../../agents/slide-core.md');
const CONTENT = read('../../../agents/content-core.md');
const REVIEW = read('../../../agents/review-core.md');

const PORTED = { FAILURE, CHEATSHEET, BLOCKS, CHARTS, COLOR, LAYOUT };

// --- Attribution red-line: every ported file carries the Akxan attribution line ---
test('every ported reference file carries the Akxan MIT attribution line', () => {
  for (const [name, body] of Object.entries(PORTED)) {
    assert.match(body, /Akxan\/ppt-agent-skill \(MIT, © 2025 sunbigfly\)/, `${name} missing attribution`);
    assert.match(body, /设计规范属通用,非原帖/, `${name} missing 非原帖 note`);
  }
});

// --- failure-modes: 8 modes present ---
test('failure-modes lists all 8 failure modes + fix-priority order', () => {
  for (const mode of [
    'underfill', 'support_collapse', 'payload_missing', 'source_overclaim',
    'launch_drift', 'anchor_overexpansion', 'deck_rhythm_clone', 'decorative_substitution',
  ]) {
    assert.match(FAILURE, new RegExp(mode), `failure-modes missing ${mode}`);
  }
  assert.match(FAILURE, /修复顺序/);
});

// --- design-cheatsheet: this repo's fields present, Akxan fields absent ---
test('design-cheatsheet references this repo fields and NOT Akxan schema fields', () => {
  assert.match(CHEATSHEET, /layout_type/);
  assert.match(CHEATSHEET, /data_elements/);
  assert.match(CHEATSHEET, /visual_weight/);
  // must NOT carry Akxan's planning schema field references
  assert.doesNotMatch(CHEATSHEET, /cards\[/, 'cheatsheet must not reference Akxan cards[]');
  assert.doesNotMatch(CHEATSHEET, /planning\.json/, 'cheatsheet must not reference Akxan planning.json');
});

// --- charts-catalog: pure SVG, no HTML/CSS techniques ---
test('charts-catalog contains NO HTML div and NO backdrop-filter (pure SVG)', () => {
  assert.doesNotMatch(CHARTS, /<div/, 'charts-catalog must not contain <div');
  assert.doesNotMatch(CHARTS, /backdrop-filter/, 'charts-catalog must not contain backdrop-filter');
  // and it should contain SVG idiom + the new chart types
  assert.match(CHARTS, /<polygon/);
  assert.match(CHARTS, /radar/i);
  assert.match(CHARTS, /funnel/i);
  assert.match(CHARTS, /gauge/i);
  assert.match(CHARTS, /waffle/i);
});

// --- blocks: SVG landing, no HTML/CSS-only weapons ---
test('blocks uses SVG landing hints, no <div> or backdrop-filter', () => {
  assert.doesNotMatch(BLOCKS, /<div/, 'blocks must not contain <div');
  assert.doesNotMatch(BLOCKS, /backdrop-filter/, 'blocks must not contain backdrop-filter');
  assert.match(BLOCKS, /<rect/);
});

// --- layout-craft: explicit no-enum-change statement, no validator touch ---
test('layout-craft opens with the explicit "do not change/add the enum" statement', () => {
  assert.match(LAYOUT, /不新增/);
  assert.match(LAYOUT, /不改/);
  assert.match(LAYOUT, /bento-grid-layout\.md/);
  assert.match(LAYOUT, /validator/);
});

// --- color-psychology: 60/30/10 + ties to P3 ---
test('color-psychology covers 60/30/10 and ties to P3 color_ratio', () => {
  assert.match(COLOR, /60\/30\/10|60-30-10/);
  assert.match(COLOR, /color_ratio/);
});

// --- ATTRIBUTIONS file ---
test('ATTRIBUTIONS.md credits Akxan MIT/sunbigfly + lists ported files + notes SVG/schema adaptation', () => {
  assert.match(ATTRIB, /MIT/);
  assert.match(ATTRIB, /sunbigfly/);
  assert.match(ATTRIB, /failure-modes\.md/);
  assert.match(ATTRIB, /charts-catalog\.md/);
  assert.match(ATTRIB, /layout-craft\.md/);
  assert.match(ATTRIB, /SVG/);
  assert.match(ATTRIB, /outline\.json|schema/);
});

// --- wiring: slide-core / content-core / review-core ---
test('slide-core wires the reference-selector for per-page supplemental refs with fallback', () => {
  assert.match(SLIDE, /reference-selector/);
  assert.match(SLIDE, /supplemental|on-demand|selected/i);
  assert.match(SLIDE, /fall back|fallback/i);
});

test('content-core may pull design-cheatsheet / failure-modes', () => {
  assert.match(CONTENT, /design-cheatsheet\.md/);
  assert.match(CONTENT, /failure-modes\.md/);
});

test('review-core QA reads failure-modes.md and follows fix-priority order', () => {
  assert.match(REVIEW, /failure-modes\.md/);
  assert.match(REVIEW, /fix-priority|fix priority/i);
});

// --- validator untouched: layout_type enum still the canonical 10 ---
test('planning-validator still enforces exactly the canonical 10 layout_type values (untouched)', () => {
  const VAL = read('../scripts/lib/planning-validator.js');
  for (const v of [
    'single_focus', 'two_column_symmetric', 'two_column_asymmetric', 'three_column',
    'hero_grid', 'mixed_grid', 'timeline', 'dashboard', 'horizontal_split', 'full_bleed',
  ]) {
    assert.match(VAL, new RegExp(v), `validator should still know ${v}`);
  }
});
