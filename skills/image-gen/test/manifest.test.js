const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load, record, bumpRedo } = require('../scripts/lib/manifest');

function tmpRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'imggen-'));
}

test('load returns empty skeleton when no manifest', () => {
  const dir = tmpRun();
  const m = load(dir);
  assert.deepStrictEqual(m.entries, {});
  assert.strictEqual(m.totals.images, 0);
  assert.strictEqual(m.totals.estUsdTotal, 0);
});

test('record writes entry and updates totals; file is valid JSON', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 0, path: 'images/scene-01.png' });
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'image-manifest.json'), 'utf8'));
  assert.strictEqual(onDisk.entries['scene-01'].backend, 'gemini-api');
  assert.strictEqual(onDisk.totals.images, 1);
  assert.ok(Math.abs(onDisk.totals.estUsdTotal - 0.067) < 1e-9);
  assert.strictEqual(onDisk.totals.meteredImages, 1);
});

test('record codex-cli entry does not count as metered', () => {
  const dir = tmpRun();
  record(dir, 'master', { backend: 'codex-cli', estUsd: 0, redoCount: 0, path: 'master/master-reference.png' });
  const m = load(dir);
  assert.strictEqual(m.totals.meteredImages, 0);
  assert.strictEqual(m.totals.images, 1);
});

test('re-recording same label replaces entry, not duplicates totals', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 0, path: 'x.png' });
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 1, path: 'x.png' });
  const m = load(dir);
  assert.strictEqual(m.totals.images, 1);
  assert.strictEqual(m.entries['scene-01'].redoCount, 1);
});

test('bumpRedo increments and persists', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'codex-cli', estUsd: 0, redoCount: 0, path: 'x.png' });
  const n = bumpRedo(dir, 'scene-01');
  assert.strictEqual(n, 1);
  assert.strictEqual(load(dir).entries['scene-01'].redoCount, 1);
});
