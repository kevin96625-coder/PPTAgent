const test = require('node:test');
const assert = require('node:assert');
const { dispatch, buildCodexArgs } = require('../scripts/lib/backends');

function fakeRunner(calls) {
  return async (spec) => {
    calls.push(spec);
    return { code: 0, stdout: 'ok', stderr: '' };
  };
}

test('codex-cli scrubs OPENAI_API_KEY from child env', async () => {
  const calls = [];
  await dispatch({
    backend: 'codex-cli',
    fullPrompt: 'draw a lamb',
    references: ['/tmp/master.png'],
    outPath: '/tmp/out.png',
    runner: fakeRunner(calls),
    env: { OPENAI_API_KEY: 'sk-should-be-removed', PATH: '/usr/bin' },
  });
  assert.strictEqual(calls.length, 1);
  assert.ok(!('OPENAI_API_KEY' in calls[0].env), 'OPENAI_API_KEY must be deleted');
  assert.strictEqual(calls[0].env.PATH, '/usr/bin');
  assert.strictEqual(calls[0].cmd, 'codex');
});

test('codex args include prompt, references and out path', () => {
  const args = buildCodexArgs({ fullPrompt: 'draw', references: ['/a.png', '/b.png'], outPath: '/o.png' });
  const joined = args.join(' ');
  assert.match(joined, /exec/);
  assert.match(joined, /\/a\.png/);
  assert.match(joined, /\/b\.png/);
  assert.match(joined, /\/o\.png/);
});

test('dispatch returns imagePath and backend meta on success', async () => {
  const r = await dispatch({
    backend: 'codex-cli', fullPrompt: 'x', references: [], outPath: '/tmp/o.png',
    runner: async () => ({ code: 0, stdout: '', stderr: '' }), env: {},
  });
  assert.strictEqual(r.imagePath, '/tmp/o.png');
  assert.strictEqual(r.meta.backend, 'codex-cli');
});

test('dispatch throws on non-zero exit', async () => {
  await assert.rejects(dispatch({
    backend: 'codex-cli', fullPrompt: 'x', references: [], outPath: '/tmp/o.png',
    runner: async () => ({ code: 1, stdout: '', stderr: 'boom' }), env: {},
  }), /codex-cli failed/);
});

test('gemini-api adapter calls runner with model + key from env', async () => {
  const calls = [];
  await dispatch({
    backend: 'gemini-api', model: 'nano-banana-pro', fullPrompt: 'x', references: [],
    outPath: '/tmp/o.png', runner: fakeRunner(calls), env: { GEMINI_API_KEY: 'k' },
  });
  assert.match(calls[0].args.join(' '), /nano-banana-pro/);
});

test('unknown backend throws', async () => {
  await assert.rejects(dispatch({ backend: 'nope', fullPrompt: 'x', references: [], outPath: '/o', runner: async () => ({}), env: {} }), /unknown backend/i);
});

const { defaultRunner } = require('../scripts/lib/backends');

test('defaultRunner executes a real process and captures exit code + stdout', async () => {
  const res = await defaultRunner({ cmd: 'node', args: ['-e', "process.stdout.write('hi')"], env: process.env });
  assert.strictEqual(res.code, 0);
  assert.match(res.stdout, /hi/);
});

test('defaultRunner reports non-zero exit', async () => {
  const res = await defaultRunner({ cmd: 'node', args: ['-e', 'process.exit(3)'], env: process.env });
  assert.strictEqual(res.code, 3);
});
