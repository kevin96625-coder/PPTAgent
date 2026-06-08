'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const OUTLINE_ARCH = read('../references/prompts/outline-architect.md');
const RESEARCH_CORE = read('../../../agents/research-core.md');
const REVIEWER = read('../../gemini-cli/references/roles/reviewer.md');
const REVIEW_CORE = read('../../../agents/review-core.md');
const PPT = read('../../../commands/ppt.md');

// Task 3 — outline schema documents asset.subject
test('outline-architect documents optional asset.subject cross-page key', () => {
  assert.match(OUTLINE_ARCH, /"subject"/);
  assert.match(OUTLINE_ARCH, /subject[\s\S]*?cross-page|cross-page[\s\S]*?subject/i);
  assert.match(OUTLINE_ARCH, /--reference/);
});

// Task 5 — research-core consistency wiring
test('research-core wires asset-consistency master-first derive with --reference', () => {
  assert.match(RESEARCH_CORE, /asset-consistency/);
  assert.match(RESEARCH_CORE, /planReferences/);
  assert.match(RESEARCH_CORE, /--reference/);
  assert.match(RESEARCH_CORE, /reference_of/);
  assert.match(RESEARCH_CORE, /master/i);
});

test('research-core degrades the group to the single-image path when the master fails', () => {
  assert.match(RESEARCH_CORE, /master[\s\S]*?(fail|degrade)/i);
  assert.match(RESEARCH_CORE, /single-image|单图|M2\.5/i);
});

// Task 6 — reviewer regenerate_image type
test('reviewer.md defines the regenerate_image suggestion type', () => {
  assert.match(REVIEWER, /regenerate_image/);
  assert.match(REVIEWER, /< 6|asset.*score|asset_score/i);
  assert.match(REVIEWER, /do NOT hand-draw|not.*hand-fix|重生成|regenerate.*not/i);
});

// Task 7 — review-core + ppt.md redo loop
test('review-core wires the redo-plan loop with new seed, cap, placeholder', () => {
  assert.match(REVIEW_CORE, /redo-plan/);
  assert.match(REVIEW_CORE, /planRedo/);
  assert.match(REVIEW_CORE, /--redo/);
  assert.match(REVIEW_CORE, /NEW seed|新 seed|不复用/i);
  assert.match(REVIEW_CORE, /cap|封顶 2/i);
  assert.match(REVIEW_CORE, /keep the placeholder|keep placeholder|占位/i);
  assert.match(REVIEW_CORE, /needs_real_image/);
  assert.match(REVIEW_CORE, /重派生|re-derive/i);
});

test('ppt.md Phase 6 routes regenerate_image through redo-plan with new seed and cap', () => {
  const p6 = PPT.match(/## Phase 6:[\s\S]*?(?=\n## Phase 7:)/);
  assert.ok(p6, 'Phase 6 exists');
  const s = p6[0];
  assert.match(s, /regenerate_image/);
  assert.match(s, /redo-plan/);
  assert.match(s, /--redo/);
  assert.match(s, /NEW seed|不复用原 seed/i);
  assert.match(s, /封顶 2|cap/i);
  assert.match(s, /keep placeholder|占位/i);
  assert.match(s, /needs_real_image/);
  assert.match(s, /重派生/);
});
