'use strict';

const { execFileSync } = require('node:child_process');

function realWhich(cmd) {
  try {
    return execFileSync('command', ['-v', cmd], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {{which:Function, nodeMajor:number}} deps
 */
function checkEnv(deps) {
  const which = deps.which || realWhich;
  const nodeMajor = deps.nodeMajor != null ? deps.nodeMajor : Number(process.versions.node.split('.')[0]);
  const codexPath = which('codex');
  const codexAvailable = !!codexPath;
  let ok = true;
  const hints = [];
  if (nodeMajor < 18) { ok = false; hints.push('Node >= 18 required.'); }
  if (!codexAvailable) {
    ok = false;
    hints.push('Default backend needs the `codex` CLI (Sign in with ChatGPT). Install it, or pass --backend gemini-api with GEMINI_API_KEY.');
  }
  return { ok, codexAvailable, codexPath, nodeMajor, hint: hints.join(' ') };
}

if (require.main === module) {
  const r = checkEnv({});
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
}

module.exports = { checkEnv };
