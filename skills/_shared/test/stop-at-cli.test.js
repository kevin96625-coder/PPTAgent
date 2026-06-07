const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '../scripts/stop-at-cli.js');

function run(args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8' });
    return { code: 0, json: JSON.parse(stdout) };
  } catch (err) {
    // execFileSync throws on non-zero exit; stdout is still captured on err.stdout
    return { code: err.status, json: JSON.parse(err.stdout) };
  }
}

test('CLI returns a run decision for a fresh stop-at=outline (exit 0)', () => {
  const { code, json } = run(['--stop-at', 'outline', '--completed', 'none']);
  assert.strictEqual(code, 0);
  assert.strictEqual(json.action, 'run');
  assert.strictEqual(json.target, 'outline');
  assert.strictEqual(json.stopPhase, 4);
});

test('CLI defaults to full when --stop-at omitted (exit 0)', () => {
  const { code, json } = run(['--completed', 'none']);
  assert.strictEqual(code, 0);
  assert.strictEqual(json.target, 'full');
});

test('CLI emits already-done for outline when already approved', () => {
  const { code, json } = run(['--stop-at', 'outline', '--completed', 'outline', '--outline-approved', 'true']);
  assert.strictEqual(code, 0);
  assert.strictEqual(json.action, 'already-done');
  assert.match(json.message, /--run-id=<id> --stop-at=full/);
});

test('CLI exits 1 with an error JSON on invalid --stop-at', () => {
  const { code, json } = run(['--stop-at', 'slides']);
  assert.strictEqual(code, 1);
  assert.match(json.error, /Invalid --stop-at "slides"/);
});
