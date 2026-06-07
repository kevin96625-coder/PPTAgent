const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PPT = fs.readFileSync(path.join(__dirname, '../../../commands/ppt.md'), 'utf8');

test('argument-hint advertises --stop-at', () => {
  const hint = PPT.split('\n').find((l) => l.startsWith('argument-hint:'));
  assert.ok(hint && hint.includes('--stop-at'), 'argument-hint should mention --stop-at');
});

test('Phase 1 parses --stop-at and calls the decision helper', () => {
  assert.match(PPT, /--stop-at/);
  assert.match(PPT, /stop-at-cli\.js/);
});

test('prose lists all five stop-at stages', () => {
  for (const s of ['research', 'outline', 'draft', 'design', 'full']) {
    assert.match(PPT, new RegExp(`\\b${s}\\b`), `prose should mention stage ${s}`);
  }
});
