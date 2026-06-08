const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const SLIDE = read('../../../agents/slide-core.md');
const REVIEW = read('../../../agents/review-core.md');
const REVIEWER = read('../../../skills/gemini-cli/references/roles/reviewer.md');
const LADDER_DOC = read('../references/typography-ladder.md');

test('slide-core references the typography ladder + ladder doc for generation', () => {
  assert.match(SLIDE, /typography_ladder/);
  assert.match(SLIDE, /references\/typography-ladder\.md/);
  assert.match(SLIDE, /color_ratio|60\/30\/10|color budget/i);
});

test('slide-core P3 validation step is explicitly advisory and never auto-rewrites/blocks', () => {
  assert.match(SLIDE, /type-color-cli/);
  assert.match(SLIDE, /advisory/i);
  assert.match(SLIDE, /never auto-rewrite/i);
  assert.match(SLIDE, /never block|never trigger a re-draw/i);
});

test('review-core passes P3 warnings as deterministic hints, no new Gemini hard rule', () => {
  assert.match(REVIEW, /deterministic hints/i);
  assert.match(REVIEW, /advisory/i);
  // must NOT promote to a quality gate / hard rule
  assert.match(REVIEW, /not a quality gate|no new Gemini hard rule|NOT a quality gate/i);
});

test('reviewer.md consumes hints as reference signals, adds no new hard-block', () => {
  assert.match(REVIEWER, /deterministic hints/i);
  assert.match(REVIEWER, /advisory|reference signal/i);
  assert.match(REVIEWER, /no new hard-block|not hard rules|NOT hard rules|no new hard rule/i);
});

test('typography-ladder doc is labelled non-original / 待复核 and micro is the only sub-14 role', () => {
  assert.match(LADDER_DOC, /通用设计规范/);
  assert.match(LADDER_DOC, /非原帖/);
  assert.match(LADDER_DOC, /待复核/);
  assert.match(LADDER_DOC, /micro/);
  assert.match(LADDER_DOC, /CJK/);
});
