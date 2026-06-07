const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const PPT = read('../../../commands/ppt.md');

test('Phase 4 invokes planning-validator-cli before the outline Hard Stop', () => {
  assert.match(PPT, /planning-validator-cli\.js/);
  const phase4 = PPT.match(/## Phase 4:[\s\S]*?(?=\n## Phase 5:)/);
  assert.ok(phase4, 'Phase 4 section should exist');
  assert.match(phase4[0], /planning-validator-cli\.js/, 'validator must be wired inside Phase 4');
});

test('Phase 4 planning_validator gate routes hard errors to content-core revise and surfaces warnings', () => {
  const phase4 = PPT.match(/## Phase 4:[\s\S]*?(?=\n## Phase 5:)/)[0];
  // the validator gate block (around the CLI invocation) must route hard errors to a content-core revise
  const gate = phase4.match(/planning-validator-cli\.js[\s\S]*?(?=\n## |\n\d+\.\s\*\*(?!.*planning))/);
  assert.ok(gate, 'validator gate block should exist');
  assert.match(gate[0], /hard_errors/);
  assert.match(gate[0], /mode=revise/);
  assert.match(gate[0], /warning|警告/i);
});

const REVIEW_CORE = read('../../../agents/review-core.md');

test('review-core mode=review passes the slide type into the Gemini prompt', () => {
  assert.match(REVIEW_CORE, /type/);
  assert.match(REVIEW_CORE, /visual_weight/);
  // the per-slide review must include the page type in the Slide Context passed to Gemini
  // (strict: requires literal "Page type:" label in the Slide Context block)
  assert.match(REVIEW_CORE, /##\s*Slide Context[\s\S]*?Page type:/);
  assert.match(REVIEW_CORE, /##\s*Slide Context[\s\S]*?Visual weight:/);
});

test('review-core derives page type for cover/end pages (no index match)', () => {
  assert.match(REVIEW_CORE, /slide_index == 1|cover/i);
  assert.match(REVIEW_CORE, /end_page\.type|total_pages/);
});
