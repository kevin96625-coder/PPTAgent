const test = require('node:test');
const assert = require('node:assert');
const { checkEnv } = require('../check_env');

test('reports codex present when which() finds it', () => {
  const r = checkEnv({ which: () => '/usr/local/bin/codex', nodeMajor: 20 });
  assert.strictEqual(r.codexAvailable, true);
  assert.strictEqual(r.ok, true);
});

test('reports codex missing and not ok for default backend', () => {
  const r = checkEnv({ which: () => null, nodeMajor: 20 });
  assert.strictEqual(r.codexAvailable, false);
  assert.match(r.hint, /codex/i);
  assert.strictEqual(r.ok, false);
});

test('flags old node', () => {
  const r = checkEnv({ which: () => '/bin/codex', nodeMajor: 16 });
  assert.strictEqual(r.ok, false);
  assert.match(r.hint, /Node/i);
});
