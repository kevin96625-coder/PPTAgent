'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { getCredential } = require('./credentials');

// ── size mapping (from StoryForge verified matrix) ──────────────────────────

const SIZES = {
  '1:1': '2048x2048',
  '16:9': '2048x1152',
  '9:16': '1152x2048',
};

const DEFAULT_MODEL = 'gpt-image-2';

// ── image model registry (2026-11) ──────────────────────────────────────────
// Subscription-first routing, matching FEASIBILITY_SUBSCRIPTION_AUTH.md:
//   GPT image models    → codex CLI's built-in image_gen tool (ChatGPT sub, $0)
//   Gemini image models → agy (Antigravity) CLI's built-in image tool (Google sub, $0)
// Metered HTTP backends (openai-fetch / gemini-fetch) remain available when
// pinned explicitly via --backend.
const IMAGE_MODELS = {
  'gpt-image-2': { backend: 'codex-cli', label: 'GPT-IMAGE-2 (LEGACY)' },
  'gpt-image-2.6-flare': { backend: 'codex-cli', label: 'GPT-IMAGE-2.6-FLARE' },
  'gpt-image-2.6-sunburst': { backend: 'codex-cli', label: 'GPT-IMAGE-2.6-SUNBURST' },
  'gemini-3.1-flash-image': { backend: 'agy-cli', label: 'GEMINI-3.1-FLASH-IMAGE' },
};

function resolveBackendForModel(model) {
  if (!model) return null;
  const entry = IMAGE_MODELS[model];
  if (entry) return entry.backend;
  if (/^(gemini|nano-banana)/.test(model)) return 'agy-cli';
  if (/^gpt-image/.test(model)) return 'codex-cli';
  return null;
}

// ── URL normalization (from StoryForge verified pattern) ────────────────────
// Input may be https://host or https://host/v1 — strip /v1 suffix first,
// then always append /v1/images/... to avoid /v1/v1/... duplication.

function normalizeBaseUrl(url) {
  let base = String(url || '').replace(/\/+$/, '');
  if (base.endsWith('/v1')) base = base.slice(0, -3);
  return base.replace(/\/+$/, '');
}

function resolveBase(env) {
  return normalizeBaseUrl(env.OPENAI_BASE_URL || getCredential('OPENAI_BASE_URL') || 'https://api.sccens.net');
}

function resolveKey(env) {
  return env.OPENAI_API_KEY || getCredential('OPENAI_API_KEY') || '';
}

// ── response parser (compatible with multiple shapes) ───────────────────────

function extractB64(payload) {
  const data = payload.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        if (typeof item.b64_json === 'string' && item.b64_json.length > 100) return item.b64_json;
      }
    }
    for (const item of data) {
      if (item && typeof item === 'object') {
        for (const field of ['url', 'image_url']) {
          const val = item[field];
          if (typeof val === 'string' && val.startsWith('data:image/') && val.includes(';base64,')) {
            const idx = val.indexOf(';base64,');
            return val.slice(idx + 8);
          }
        }
      }
    }
  }
  const images = payload.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === 'string' && item.length > 100) return item;
      if (item && typeof item === 'object' && typeof item.b64_json === 'string') return item.b64_json;
    }
  }
  const output = payload.output;
  if (output && typeof output === 'object' && Array.isArray(output.b64_json)) {
    const first = output.b64_json[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.bytesBase64 === 'string') return first.bytesBase64;
  }
  return null;
}

function extractUrl(payload) {
  const data = payload.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        for (const field of ['url', 'image_url']) {
          const val = item[field];
          if (typeof val === 'string' && val.startsWith('http')) return val;
        }
      }
    }
  }
  return null;
}

function saveB64(b64, outPath) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 8) throw new Error('openai-fetch: decoded image too small');
  const magic = buf.slice(0, 8).toString('hex');
  if (!magic.startsWith('89504e47') && !magic.startsWith('ffd8ff') && !magic.startsWith('52494646')) {
    throw new Error('openai-fetch: decoded bytes do not look like a valid image (magic mismatch)');
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
}

// ── openai-fetch backend ────────────────────────────────────────────────────

async function dispatchOpenaiFetch(opts, env) {
  const apiKey = resolveKey(env);
  const base = resolveBase(env);
  const model = opts.model || DEFAULT_MODEL;
  if (!apiKey) throw new Error('openai-fetch: API key not configured (set OPENAI_API_KEY in env or .env)');
  const size = SIZES[opts.aspect] || SIZES['1:1'];
  const references = opts.references || [];

  if (references.length > 0) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', opts.fullPrompt);
    form.append('n', '1');
    form.append('size', size);
    for (const ref of references) {
      if (fs.existsSync(ref)) {
        const buf = fs.readFileSync(ref);
        form.append('image', new File([buf], path.basename(ref), { type: 'image/png' }));
      }
    }
    const res = await fetch(`${base}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const status = res.status;
      const text = await res.text().catch(() => '');
      throw new Error(`openai-fetch /images/edits ${status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const b64 = extractB64(json);
    if (b64) {
      saveB64(b64, opts.outPath);
      return { imagePath: opts.outPath, meta: { backend: 'openai-fetch', model } };
    }
    const url = extractUrl(json);
    if (url) {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`openai-fetch: failed to download image URL (${imgRes.status})`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
      fs.writeFileSync(opts.outPath, buf);
      return { imagePath: opts.outPath, meta: { backend: 'openai-fetch', model } };
    }
    throw new Error('openai-fetch /images/edits: no image data in response');
  }

  const body = { model, prompt: opts.fullPrompt, n: 1, size, response_format: 'b64_json' };
  const res = await fetch(`${base}/v1/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const status = res.status;
    const text = await res.text().catch(() => '');
    throw new Error(`openai-fetch /images/generations ${status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const b64 = extractB64(json);
  if (b64) {
    saveB64(b64, opts.outPath);
    return { imagePath: opts.outPath, meta: { backend: 'openai-fetch', model } };
  }
  const url = extractUrl(json);
  if (url) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`openai-fetch: failed to download image URL (${imgRes.status})`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
    fs.writeFileSync(opts.outPath, buf);
    return { imagePath: opts.outPath, meta: { backend: 'openai-fetch', model } };
  }
  throw new Error('openai-fetch /images/generations: no image data in response');
}

// ── codex-cli backend ────────────────────────────────────────────────────────

function buildCodexArgs({ references }) {
  const args = ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write'];
  for (const ref of references || []) {
    args.push('--image', ref);
  }
  return args;
}

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

// ── agy-cli backend (Antigravity CLI, Google subscription) ──────────────────
// Same instruction-driven pattern as codex-cli: the CLI's built-in image tool
// generates and writes the file. Reference images are attached via @file paths
// inside the prompt text (absolute paths verified working). --model pins the
// driver text model that runs the agent loop; the image model itself is the
// backend's built-in (gemini-3.1-flash-image).

const AGY_DRIVER_MODEL = 'gemini-4-hydrogen-xhigh';

function buildAgyArgs() {
  // NOTE: --model must precede -p (agy errors when -p swallows the next flag).
  return ['--model', AGY_DRIVER_MODEL, '--dangerously-skip-permissions'];
}

function buildAgyInstruction({ fullPrompt, references, outPath }) {
  const refNote = references && references.length
    ? `Reference image(s) to read first: ${references.map((r) => `@${r}`).join(' ')}. `
      + 'They define the main character(s) — keep them visually identical (face, hair, clothing, art style). '
    : '';
  return (
    `Generate ONE image using your built-in image generation capability and save the file exactly to "${outPath}". `
    + refNote
    + 'Do not create, modify, or delete any other files. After saving, reply with just: DONE\n\n'
    + `Image prompt:\n${fullPrompt}`
  );
}

// ── gemini-fetch backend (direct generativelanguage REST) ───────────────────
// One endpoint covers all three flows:
//   text-to-image  — text prompt only
//   image-to-image / edit — reference images as inline_data parts + prompt
// Requires GEMINI_API_KEY (or GOOGLE_API_KEY) in env or skills/image-gen/.env.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-image';
const GEMINI_ASPECTS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']);

function resolveGeminiKey(env) {
  // Explicit env key (even empty string) disables the .env fallback, so tests
  // can force the no-key path regardless of the machine's stored credentials.
  const fromEnv = (k) => (env && Object.prototype.hasOwnProperty.call(env, k))
    ? env[k] : (process.env[k] || getCredential(k));
  return fromEnv('GEMINI_API_KEY') || fromEnv('GOOGLE_API_KEY') || '';
}

function guessMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function buildGeminiBody(opts) {
  const parts = [{ text: opts.fullPrompt }];
  for (const ref of opts.references || []) {
    if (!fs.existsSync(ref)) continue;
    parts.push({
      inline_data: { mime_type: guessMime(ref), data: fs.readFileSync(ref).toString('base64') },
    });
  }
  const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
  if (GEMINI_ASPECTS.has(opts.aspect)) generationConfig.imageConfig = { aspectRatio: opts.aspect };
  return {
    model: opts.model || GEMINI_DEFAULT_MODEL,
    url: `${GEMINI_API_BASE}/models/${encodeURIComponent(opts.model || GEMINI_DEFAULT_MODEL)}:generateContent`,
    body: { contents: [{ role: 'user', parts }], generationConfig },
  };
}

// Response candidates use camelCase inlineData over REST but some gateways echo
// the snake_case proto spelling — accept both.
function extractGeminiB64(payload) {
  for (const cand of payload.candidates || []) {
    for (const part of (cand.content && cand.content.parts) || []) {
      const inline = part.inlineData || part.inline_data;
      if (inline && typeof inline.data === 'string' && inline.data.length > 100) return inline.data;
    }
  }
  return null;
}

async function dispatchGeminiFetch(opts, env) {
  const apiKey = resolveGeminiKey(env);
  if (!apiKey) {
    throw new Error(
      'gemini-fetch: GEMINI_API_KEY not configured (set it in skills/image-gen/.env — '
      + 'free-tier key from aistudio.google.com works for gemini image models)',
    );
  }
  const { url, body } = buildGeminiBody(opts);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const status = res.status;
    const text = await res.text().catch(() => '');
    throw new Error(`gemini-fetch generateContent ${status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = extractGeminiB64(json);
  if (!b64) {
    const block = json.promptFeedback && json.promptFeedback.blockReason;
    throw new Error(`gemini-fetch: no image data in response${block ? ` (blocked: ${block})` : ''}`);
  }
  saveB64(b64, opts.outPath);
  return { imagePath: opts.outPath, meta: { backend: 'gemini-fetch', model: body.model } };
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

// ── dispatch ─────────────────────────────────────────────────────────────────

async function dispatch(opts) {
  const { backend, fullPrompt, references = [], outPath, runner } = opts;
  const env = Object.assign({}, opts.env || {});

  if (backend === 'openai-fetch') {
    return dispatchOpenaiFetch({ ...opts, fullPrompt, references, outPath }, env);
  }

  if (backend === 'codex-cli') {
    delete env.OPENAI_API_KEY;
    const args = buildCodexArgs({ references });
    const input = buildCodexInstruction({ fullPrompt, references, outPath });
    const res = await runner({ cmd: 'codex', args, env, input });
    if (!res || res.code !== 0) {
      throw new Error(`codex-cli failed (code ${res && res.code}): ${res && res.stderr}`);
    }
    return { imagePath: outPath, meta: { backend, model: opts.model || 'gpt-image-2.6-flare' } };
  }

  if (backend === 'agy-cli') {
    const args = buildAgyArgs();
    const input = buildAgyInstruction({ fullPrompt, references, outPath });
    const res = await runner({ cmd: 'agy', args, env, input });
    if (!res || res.code !== 0) {
      throw new Error(`agy-cli failed (code ${res && res.code}): ${res && res.stderr}`);
    }
    if (!fs.existsSync(outPath)) {
      throw new Error(`agy-cli exited 0 but did not write "${outPath}"`);
    }
    return { imagePath: outPath, meta: { backend, model: opts.model || 'gemini-3.1-flash-image' } };
  }

  if (backend === 'gemini-api') {
    const model = opts.model || 'nano-banana-2';
    const args = buildGeminiArgs({ fullPrompt, references, outPath, model });
    const res = await runner({ cmd: 'image-gen-gemini', args, env });
    if (!res || res.code !== 0) throw new Error(`gemini-api failed (code ${res && res.code}): ${res && res.stderr}`);
    return { imagePath: outPath, meta: { backend, model } };
  }

  if (backend === 'gemini-fetch') {
    return dispatchGeminiFetch(opts, env);
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

// ── default subprocess runner ────────────────────────────────────────────────

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

module.exports = {
  dispatch, defaultRunner, buildCodexArgs, buildCodexInstruction, buildGeminiArgs, buildOpenaiArgs,
  normalizeBaseUrl, extractB64, SIZES, IMAGE_MODELS, resolveBackendForModel, buildGeminiBody,
  extractGeminiB64, buildAgyArgs, buildAgyInstruction, AGY_DRIVER_MODEL,
};
