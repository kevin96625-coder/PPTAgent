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

test('Phase 4 routes hard errors to content-core revise and surfaces warnings at the Hard Stop', () => {
  const phase4 = PPT.match(/## Phase 4:[\s\S]*?(?=\n## Phase 5:)/)[0];
  assert.match(phase4, /mode=revise|revise/);
  assert.match(phase4, /warning|警告/i);
});
