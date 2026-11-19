const test = require('node:test');
const assert = require('node:assert');
const {
  dispatch, buildCodexArgs, buildCodexInstruction,
  buildAgyArgs, buildAgyInstruction, AGY_DRIVER_MODEL,
  resolveBackendForModel, buildGeminiBody, extractGeminiB64,
} = require('../scripts/lib/backends');

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
  // prompt is delivered on stdin, NOT as an argv positional (avoids variadic --image swallow)
  assert.match(calls[0].input, /draw a lamb/);
  assert.ok(!calls[0].args.join(' ').includes('draw a lamb'), 'prompt must not be in argv');
});

test('codex args carry sandbox + skip-git flags and references via --image (no prompt)', () => {
  const args = buildCodexArgs({ references: ['/a.png', '/b.png'] });
  const joined = args.join(' ');
  assert.match(joined, /^exec /);
  assert.match(joined, /--skip-git-repo-check/);
  assert.match(joined, /--sandbox workspace-write/);
  assert.match(joined, /--image \/a\.png/);
  assert.match(joined, /--image \/b\.png/);
});

test('codex instruction carries the out path and prompt, and a ref note when references exist', () => {
  const withRef = buildCodexInstruction({ fullPrompt: 'a calm sea', references: ['/m.png'], outPath: '/o.png' });
  assert.match(withRef, /\/o\.png/);
  assert.match(withRef, /a calm sea/);
  assert.match(withRef, /reference image/i);
  const noRef = buildCodexInstruction({ fullPrompt: 'a lamp', references: [], outPath: '/o.png' });
  assert.doesNotMatch(noRef, /reference image/i);
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

// ── image model routing + CLI backends ──────────────────────────────────────

test('resolveBackendForModel routes subscription-first: GPT→codex, Gemini→agy', () => {
  assert.strictEqual(resolveBackendForModel('gpt-image-2.5-flare'), 'codex-cli');
  assert.strictEqual(resolveBackendForModel('gpt-image-2.5-sunburst'), 'codex-cli');
  assert.strictEqual(resolveBackendForModel('gpt-image-2'), 'codex-cli');
  assert.strictEqual(resolveBackendForModel('gemini-3.1-flash-image'), 'agy-cli');
  assert.strictEqual(resolveBackendForModel('nano-banana-2'), 'agy-cli');
  assert.strictEqual(resolveBackendForModel(null), null);
  assert.strictEqual(resolveBackendForModel('totally-unknown'), null);
});

test('agy args pin driver model before -p and skip permissions', () => {
  const args = buildAgyArgs();
  assert.deepStrictEqual(args, ['--model', AGY_DRIVER_MODEL, '--dangerously-skip-permissions']);
});

test('agy instruction carries out path, @file references, and prompt', () => {
  const withRef = buildAgyInstruction({ fullPrompt: 'a calm sea', references: ['/m.png', '/s.png'], outPath: '/o.png' });
  assert.match(withRef, /\/o\.png/);
  assert.match(withRef, /@\/m\.png @\/s\.png/);
  assert.match(withRef, /a calm sea/);
  assert.match(withRef, /DONE/);
  const noRef = buildAgyInstruction({ fullPrompt: 'a lamp', references: [], outPath: '/o.png' });
  assert.doesNotMatch(noRef, /@/);
});

test('agy-cli dispatch fails loudly when the CLI exits without writing the image', async () => {
  const os = require('node:fs');
  const missing = `/tmp/agy-missing-${Date.now()}.png`;
  await assert.rejects(dispatch({
    backend: 'agy-cli', model: 'gemini-3.1-flash-image',
    fullPrompt: 'x', references: [], outPath: missing,
    runner: async () => ({ code: 0, stdout: 'DONE', stderr: '' }), env: {},
  }), /did not write/);
  assert.ok(!os.existsSync(missing));
});

test('codex-cli meta echoes the requested image model', async () => {
  const r = await dispatch({
    backend: 'codex-cli', model: 'gpt-image-2.5-sunburst', fullPrompt: 'x', references: [],
    outPath: '/tmp/o.png', runner: async () => ({ code: 0, stdout: '', stderr: '' }), env: {},
  });
  assert.strictEqual(r.meta.model, 'gpt-image-2.5-sunburst');
});

test('buildGeminiBody: text-only prompt is pure text-to-image with aspect', () => {
  const { model, url, body } = buildGeminiBody({ fullPrompt: 'a lamb', model: 'gemini-3.1-flash-image', aspect: '4:3', references: [] });
  assert.strictEqual(model, 'gemini-3.1-flash-image');
  assert.match(url, /models\/gemini-3\.1-flash-image:generateContent$/);
  assert.deepStrictEqual(body.contents[0].parts, [{ text: 'a lamb' }]);
  assert.deepStrictEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.strictEqual(body.generationConfig.imageConfig.aspectRatio, '4:3');
});

test('buildGeminiBody: references become inline_data parts (image-to-image / edit)', () => {
  const ref = '/tmp/fake-master.png';
  const origExists = require('node:fs').existsSync;
  require('node:fs').existsSync = () => true;
  const origRead = require('node:fs').readFileSync;
  require('node:fs').readFileSync = (p, enc) => (p === ref ? Buffer.from('fakepngbytes') : origRead(p, enc));
  try {
    const { body } = buildGeminiBody({ fullPrompt: 'edit this', model: 'gemini-3.1-flash-image', aspect: '4:3', references: [ref] });
    const parts = body.contents[0].parts;
    assert.strictEqual(parts.length, 2);
    assert.strictEqual(parts[0].type, undefined); // plain text part
    assert.match(String(parts[0].text), /edit this/);
    assert.deepStrictEqual(parts[1].inline_data, { mime_type: 'image/png', data: Buffer.from('fakepngbytes').toString('base64') });
  } finally {
    require('node:fs').existsSync = origExists;
    require('node:fs').readFileSync = origRead;
  }
});

test('buildGeminiBody: unsupported aspect is omitted from imageConfig', () => {
  const { body } = buildGeminiBody({ fullPrompt: 'x', model: 'gemini-3.1-flash-image', aspect: '7:3', references: [] });
  assert.strictEqual(body.generationConfig.imageConfig, undefined);
});

test('extractGeminiB64 accepts both camelCase and snake_case inline payloads', () => {
  const b64 = 'A'.repeat(150);
  assert.strictEqual(extractGeminiB64({ candidates: [{ content: { parts: [{ inlineData: { data: b64 } }] } }] }), b64);
  assert.strictEqual(extractGeminiB64({ candidates: [{ content: { parts: [{ inline_data: { data: b64 } }] } }] }), b64);
  assert.strictEqual(extractGeminiB64({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] }), null);
});

test('gemini-fetch surfaces a clear error when no API key is configured', async () => {
  await assert.rejects(dispatch({
    backend: 'gemini-fetch', model: 'gemini-3.1-flash-image',
    fullPrompt: 'x', references: [], outPath: '/tmp/o.png', env: { GEMINI_API_KEY: '' },
  }), /GEMINI_API_KEY not configured/);
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
