const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PPT = fs.readFileSync(path.join(__dirname, '../../../commands/ppt.md'), 'utf8');

test('argument-hint advertises --stop-at', () => {
  const hint = PPT.split('\n').find((l) => l.startsWith('argument-hint:'));
  assert.ok(hint && hint.includes('--stop-at'), 'argument-hint should mention --stop-at');
});

test('Phase 1 invokes stop-at-cli.js with the --stop-at flag', () => {
  // The bash block must wire the flag to the CLI, not just mention --stop-at in prose.
  assert.match(PPT, /stop-at-cli\.js[\s\S]*?--stop-at/, 'item 7 should call stop-at-cli.js with --stop-at');
});

test('item 7 enumerates all five stop-at stages', () => {
  const item7 = PPT.match(/\*\*Resolve the stop target[\s\S]*?(?=\n## )/)?.[0] ?? '';
  assert.ok(item7, 'item 7 (Resolve the stop target) should exist');
  for (const s of ['research', 'outline', 'draft', 'design', 'full']) {
    assert.match(item7, new RegExp(`\\b${s}\\b`), `item 7 should mention stage ${s}`);
  }
});
