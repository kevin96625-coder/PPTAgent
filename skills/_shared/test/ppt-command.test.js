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

test('each of Phases 3-6 has a stop-at checkpoint', () => {
  const checkpoints = PPT.match(/Stop-at checkpoint/g) || [];
  assert.ok(checkpoints.length >= 4, `expected >=4 stop-at checkpoints, found ${checkpoints.length}`);
});

test('early delivery writes output/README.md with a resume command', () => {
  assert.match(PPT, /output\/README\.md/);
  assert.match(PPT, /--run-id=\$\{CHANGE_ID\}/);
});

test('early-delivery README block documents per-stage artifacts', () => {
  assert.match(PPT, /Early-delivery README/);
});

test('each stop-at checkpoint names its target stage', () => {
  for (const t of ['research', 'outline', 'draft', 'design']) {
    assert.match(PPT, new RegExp(`Stop-at checkpoint \\(${t}\\)`), `missing checkpoint for ${t}`);
  }
});

test('early-delivery artifact table has a row per early-stop target', () => {
  for (const t of ['research', 'outline', 'draft', 'design']) {
    assert.match(PPT, new RegExp(`\\| \`${t}\` \\|`), `missing artifact-table row for ${t}`);
  }
});
