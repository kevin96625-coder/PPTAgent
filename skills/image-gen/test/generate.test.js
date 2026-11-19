const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, run } = require('../scripts/generate');

function tmpRun() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); }

test('parseArgs leaves backend unset by default and splits references', () => {
  const a = parseArgs(['--run-dir', '/r', '--label', 'scene-01', '--out', '/o.png',
    '--prompt', 'hi', '--reference', '/a.png,/b.png']);
  assert.strictEqual(a.backend, null);
  assert.deepStrictEqual(a.references, ['/a.png', '/b.png']);
  assert.strictEqual(a.label, 'scene-01');
});

test('run routes gemini image models to the agy subscription backend', async () => {
  const dir = tmpRun();
  const out = await run({
    runDir: dir, label: 'scene-g', out: path.join(dir, 'o.png'),
    prompt: 'a lamb', model: 'gemini-3.1-flash-image', estimateOnly: true,
  }, { runner: async () => ({ code: 0 }), env: {} });
  assert.strictEqual(out.estimate.estUsdTotal, 0);
  assert.match(out.estimate.quotaNote, /agy/);
  assert.strictEqual(out.estimate.model, 'gemini-3.1-flash-image');
});

test('run estimates fine for gpt-image-2.6 tiers via codex routing', async () => {
  const dir = tmpRun();
  for (const m of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']) {
    const out = await run({
      runDir: dir, label: `scene-${m}`, out: path.join(dir, 'o.png'),
      prompt: 'a lamb', model: m, estimateOnly: true,
    }, { runner: async () => ({ code: 0 }), env: {} });
    assert.strictEqual(out.estimate.model, m);
    assert.strictEqual(out.estimate.estUsdTotal, 0);
    assert.match(out.estimate.quotaNote, /ChatGPT subscription/);
  }
});

test('run with --estimate-only returns estimate and writes nothing', async () => {
  const dir = tmpRun();
  const out = await run(parseArgs([
    '--run-dir', dir, '--label', 'scene-01', '--out', path.join(dir, 'o.png'),
    '--prompt', 'a lamb', '--backend', 'gemini-api', '--model', 'nano-banana-pro', '--estimate-only',
  ]), { runner: async () => ({ code: 0 }) });
  assert.ok(out.estimate.estUsdTotal > 0);
  assert.strictEqual(fs.existsSync(path.join(dir, 'image-manifest.json')), false);
});

test('run (codex-cli) invokes runner, writes manifest entry with zero cost', async () => {
  const dir = tmpRun();
  const outPath = path.join(dir, 'o.png');
  const calls = [];
  const out = await run(parseArgs([
    '--run-dir', dir, '--label', 'master', '--out', outPath, '--prompt', 'jesus',
    '--reference', '/m.png', '--backend', 'codex-cli',
  ]), { runner: async (s) => { calls.push(s); fs.writeFileSync(outPath, 'PNG'); return { code: 0, stdout: '', stderr: '' }; } });

  assert.strictEqual(out.imagePath, outPath);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'image-manifest.json'), 'utf8'));
  assert.strictEqual(m.entries.master.backend, 'codex-cli');
  assert.strictEqual(m.entries.master.estUsd, 0);
  assert.ok(!('OPENAI_API_KEY' in calls[0].env));
});

test('run throws if neither --prompt nor --prompt-file given', async () => {
  await assert.rejects(run(parseArgs(['--run-dir', '/r', '--label', 'x', '--out', '/o.png']), {}), /prompt/);
});

test('run with --redo bumps redo count on existing label', async () => {
  const dir = tmpRun();
  const outPath = path.join(dir, 'o.png');
  const opts = { runner: async () => { fs.writeFileSync(outPath, 'PNG'); return { code: 0 }; } };
  const base = ['--run-dir', dir, '--label', 'scene-01', '--out', outPath, '--prompt', 'x', '--backend', 'codex-cli'];
  await run(parseArgs(base), opts);
  const out2 = await run(parseArgs(base.concat(['--redo'])), opts);
  assert.strictEqual(out2.redoCount, 1);
});
