'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { assembleFullPrompt } = require('./lib/prompt');
const { estimate } = require('./lib/cost');
const manifest = require('./lib/manifest');
const { dispatch, defaultRunner } = require('./lib/backends');

function parseArgs(argv) {
  const a = {
    backend: 'codex-cli', references: [], aspect: '4:3', seed: null,
    redo: false, estimateOnly: false, model: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--run-dir': a.runDir = v; i++; break;
      case '--label': a.label = v; i++; break;
      case '--out': a.out = v; i++; break;
      case '--prompt': a.prompt = v; i++; break;
      case '--prompt-file': a.promptFile = v; i++; break;
      case '--identity-file': a.identityFile = v; i++; break;
      case '--style-file': a.styleFile = v; i++; break;
      case '--reference': a.references = String(v).split(',').map((s) => s.trim()).filter(Boolean); i++; break;
      case '--backend': a.backend = v; i++; break;
      case '--model': a.model = v; i++; break;
      case '--aspect': a.aspect = v; i++; break;
      case '--seed': a.seed = Number(v); i++; break;
      case '--redo': a.redo = true; break;
      case '--estimate-only': a.estimateOnly = true; break;
      default: break;
    }
  }
  return a;
}

function readMaybe(file) {
  return file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

async function run(args, deps = {}) {
  const runner = deps.runner || defaultRunner;
  const env = deps.env || process.env;
  if (!args.runDir || !args.label || !args.out) {
    throw new Error('run: --run-dir, --label and --out are required');
  }
  const sceneBrief = args.prompt || readMaybe(args.promptFile);
  if (!sceneBrief || !sceneBrief.trim()) {
    throw new Error('run: provide --prompt or --prompt-file');
  }
  const fullPrompt = assembleFullPrompt({
    sceneBrief,
    identityBlock: readMaybe(args.identityFile),
    styleBlock: readMaybe(args.styleFile),
  });

  const est = estimate({ backend: args.backend, model: args.model, count: 1 });
  if (args.estimateOnly) {
    return { estimate: est, fullPrompt };
  }

  const { imagePath, meta } = await dispatch({
    backend: args.backend, model: args.model, fullPrompt,
    references: args.references, aspect: args.aspect, seed: args.seed,
    outPath: args.out, runner, env,
  });

  const promptHash = crypto.createHash('sha256').update(fullPrompt).digest('hex').slice(0, 12);
  const existing = manifest.load(args.runDir).entries[args.label];
  const redoCount = args.redo && existing ? (existing.redoCount || 0) + 1 : (existing ? existing.redoCount || 0 : 0);

  manifest.record(args.runDir, args.label, {
    backend: meta.backend, model: meta.model, path: imagePath,
    seed: args.seed, estUsd: est.estUsdTotal, redoCount, promptHash,
  });

  return { imagePath, estimate: est, redoCount, fullPrompt };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((r) => {
      if (r.estimate && !r.imagePath) {
        console.log(JSON.stringify({ estimate: r.estimate }, null, 2));
      } else {
        console.log(JSON.stringify({ imagePath: r.imagePath, estimate: r.estimate, redoCount: r.redoCount }, null, 2));
      }
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { parseArgs, run };
