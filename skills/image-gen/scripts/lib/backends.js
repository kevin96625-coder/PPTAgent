'use strict';

// Codex `exec` argument template. The reference-image flag (`--image`) is the
// one runtime-version-dependent piece — verified in Task 9 against the installed
// codex version. Keep all Codex specifics here.
function buildCodexArgs({ fullPrompt, references, outPath }) {
  const args = ['exec'];
  for (const ref of references || []) {
    args.push('--image', ref);
  }
  // Instruct the built-in image_gen tool explicitly and pin the output path.
  const instruction =
    `$imagegen Generate ONE image and save it to "${outPath}". ` +
    `Use the attached reference image(s) to keep the main character visually identical. ` +
    `Prompt:\n${fullPrompt}`;
  args.push(instruction);
  return args;
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
    const args = buildCodexArgs({ fullPrompt, references, outPath });
    const res = await runner({ cmd: 'codex', args, env });
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
    if (spec.input != null) { child.stdin.write(spec.input); child.stdin.end(); }
  });
}

module.exports = { dispatch, defaultRunner, buildCodexArgs, buildGeminiArgs, buildOpenaiArgs };
