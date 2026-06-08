const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const SCRIPT = path.join(__dirname, '../../agent-reach/scripts/image-search.sh');

test('image-search.sh runs under bash; usage error (exit 2) on no args', () => {
  const r = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  // no args -> usage error (exit 2), must not hang or crash interpreter
  assert.notEqual(r.status, null);
  assert.equal(r.status, 2);
});

test('image-search.sh degrades gracefully (no source -> nonzero, reason on stderr)', () => {
  const r = spawnSync('bash', [SCRIPT, 'somequery', '/tmp/m25-imgsearch-out.jpg'], { encoding: 'utf8', timeout: 60000 });
  // Either it found an image (exit 0 + path) OR degraded (nonzero + reason). Never crash (status !== null).
  assert.notEqual(r.status, null);
  if (r.status !== 0) assert.match((r.stderr || '') + (r.stdout || ''), /no-image-source/);
});
