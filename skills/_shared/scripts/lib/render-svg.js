'use strict';
const fs = require('node:fs');
const path = require('node:path');
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

// Make relative `<image href="images/...">` hrefs resolve at render time.
// SVGs live in `${run_dir}/slides/slide-NN.svg`, but images live in
// `${run_dir}/images/`, so an href of `images/...` would resolve to the
// (non-existent) `${run_dir}/slides/images/...`. If the SVG's own dir has no
// `images` entry but the PARENT dir does, create an idempotent relative symlink
// `<svgdir>/images -> ../images`. Never throws — returns true if the symlink
// now exists (created or pre-existing), false otherwise (incl. on any error).
function stageImages(svgPath) {
  try {
    const svgDir = path.dirname(path.resolve(svgPath));
    const localImages = path.join(svgDir, 'images');
    if (fs.existsSync(localImages)) return true; // already resolvable (dir or symlink)
    const parentImages = path.join(path.dirname(svgDir), 'images');
    if (!fs.existsSync(parentImages)) return false; // nothing to stage
    // `ln -sfn` semantics: relative symlink, idempotent.
    fs.symlinkSync('../images', localImages);
    return true;
  } catch {
    return false;
  }
}

// Returns {ok:boolean, reason?:string}. Never throws.
function renderSvg(svgPath, pngPath, chrome = findChrome()) {
  if (!chrome) return { ok: false, reason: 'chrome-not-found' };
  stageImages(svgPath); // best-effort: resolve relative images/ hrefs before Chrome runs
  const r = spawnSync(chrome, buildRenderArgs(svgPath, pngPath), { encoding: 'utf8' });
  if (r.status !== 0) return { ok: false, reason: (r.stderr || 'render-failed').slice(0, 200) };
  if (!fs.existsSync(pngPath)) return { ok: false, reason: 'no-output' };
  return { ok: true };
}

module.exports = { findChrome, buildRenderArgs, renderSvg, stageImages, CHROME_CANDIDATES };
