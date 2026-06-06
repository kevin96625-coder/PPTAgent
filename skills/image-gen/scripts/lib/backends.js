'use strict';

// Codex `exec` argument template — VERIFIED against codex-cli 0.137.0 (2026-06-07,
// real subscription generation). Working invocation:
//   printf '%s' "<instruction>" | codex exec --skip-git-repo-check \
//     --sandbox workspace-write --image <ref> [--image <ref> ...]
// Notes baked in from the live test:
//  - The prompt MUST be delivered on STDIN, not as an argv positional: `--image`
//    is variadic and would otherwise swallow a trailing prompt argument.
//  - `--sandbox workspace-write` is required so Codex can save the PNG to disk.
//  - `--skip-git-repo-check` allows running when the RUN_DIR is not a trusted git repo.
// Keep all Codex specifics here.
function buildCodexArgs({ references }) {
  const args = ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write'];
  for (const ref of references || []) {
    args.push('--image', ref);
  }
  return args;
}

// The instruction is delivered to Codex on STDIN (see buildCodexArgs note).
function buildCodexInstruction({ fullPrompt, references, outPath }) {
  const refNote = references && references.length
    ? 'The attached reference image(s) define the main character — keep that character '
      + 'visually identical (face, hair, clothing, art style). '
    : '';
  return (
    `Use your built-in image generation tool to generate ONE image and save it to "${outPath}". `
    + refNote
    + 'Do not create, modify, or delete any other files. After saving, stop immediately.\n\n'
    + `Image prompt:\n${fullPrompt}`
  );
}

function buildGeminiArgs({ fullPrompt, references, outPath, model }) {
  const args = ['--model', model || 'nano-banana-2', '--out', outPath];
  for (const ref of references || []) args.push('--reference', ref);
  args.push('--prompt', fullPrompt);
  return args;
}

function buildOpenaiArgs({ fullPrompt, references, outPath, model }) {
  const args = ['--model', model || 'gpt-image-2', '--out', outPath];
  for (const ref of references || []) args.push('--image', ref);
  args.push('--prompt', fullPrompt);
  return args;
}

async function dispatch(opts) {
  const { backend, fullPrompt, references = [], outPath, runner } = opts;
  const env = Object.assign({}, opts.env || {});

  if (backend === 'codex-cli') {
    // CRITICAL: never let Codex see an API key, or it bills the API instead of the subscription.
    delete env.OPENAI_API_KEY;
    const args = buildCodexArgs({ references });
    const input = buildCodexInstruction({ fullPrompt, references, outPath });
    const res = await runner({ cmd: 'codex', args, env, input });
    if (!res || res.code !== 0) {
      throw new Error(`codex-cli failed (code ${res && res.code}): ${res && res.stderr}`);
    }
    return { imagePath: outPath, meta: { backend, model: 'gpt-image-2' } };
  }

  if (backend === 'gemini-api') {
    const model = opts.model || 'nano-banana-2';
    const args = buildGeminiArgs({ fullPrompt, references, outPath, model });
    const res = await runner({ cmd: 'image-gen-gemini', args, env });
    if (!res || res.code !== 0) throw new Error(`gemini-api failed (code ${res && res.code}): ${res && res.stderr}`);
    return { imagePath: outPath, meta: { backend, model } };
  }

  if (backend === 'openai-api') {
    const model = opts.model || 'gpt-image-2';
    const args = buildOpenaiArgs({ fullPrompt, references, outPath, model });
    const res = await runner({ cmd: 'image-gen-openai', args, env });
    if (!res || res.code !== 0) throw new Error(`openai-api failed (code ${res && res.code}): ${res && res.stderr}`);
    return { imagePath: outPath, meta: { backend, model } };
  }

  throw new Error(`dispatch: unknown backend "${backend}"`);
}

const { spawn } = require('node:child_process');

/**
 * Real subprocess runner. @param {{cmd, args, env, input?}} spec
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function defaultRunner(spec) {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.cmd, spec.args, { env: spec.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code == null ? -1 : code, stdout, stderr }));
    if (spec.input != null) {
      try { child.stdin.write(spec.input); child.stdin.end(); }
      catch (_) { /* child already exited; broken pipe is expected */ }
    }
  });
}

module.exports = { dispatch, defaultRunner, buildCodexArgs, buildCodexInstruction, buildGeminiArgs, buildOpenaiArgs };
