const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const CLI = path.join(__dirname, '../scripts/svg-autofix-cli.js');

test('CLI fixes a file in place to stdout/out and stays valid-ish', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26-'));
  const f = path.join(dir, 's.svg');
  fs.writeFileSync(f, `<svg viewBox="0 0 1280 720"><text x="60" y="100" font-size="9" fill="#f1f5f9">x</text></svg>`);
  const out = path.join(dir, 'o.svg');
  const r = spawnSync('node', [CLI, f, '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(fs.readFileSync(out, 'utf8'), /font-size="14"/);
});
test('CLI usage error on no args', () => {
  const r = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
