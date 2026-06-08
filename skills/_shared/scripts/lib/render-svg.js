'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  const which = spawnSync('bash', ['-lc', 'command -v google-chrome || command -v chromium || command -v chromium-browser'], { encoding: 'utf8' });
  const out = (which.stdout || '').trim();
  return out ? out.split('\n')[0] : null;
}

function buildRenderArgs(svgPath, pngPath) {
  return [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--screenshot=${pngPath}`, '--window-size=1280,720',
    `file://${svgPath}`,
  ];
}

// Returns {ok:boolean, reason?:string}. Never throws.
function renderSvg(svgPath, pngPath, chrome = findChrome()) {
  if (!chrome) return { ok: false, reason: 'chrome-not-found' };
  const r = spawnSync(chrome, buildRenderArgs(svgPath, pngPath), { encoding: 'utf8' });
  if (r.status !== 0) return { ok: false, reason: (r.stderr || 'render-failed').slice(0, 200) };
  if (!fs.existsSync(pngPath)) return { ok: false, reason: 'no-output' };
  return { ok: true };
}

module.exports = { findChrome, buildRenderArgs, renderSvg, CHROME_CANDIDATES };
