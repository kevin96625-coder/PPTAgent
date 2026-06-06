'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FILE = 'image-manifest.json';

function manifestPath(runDir) {
  return path.join(runDir, FILE);
}

function skeleton() {
  return {
    backend_default: 'codex-cli',
    entries: {},
    totals: { images: 0, estUsdTotal: 0, meteredImages: 0 },
  };
}

function load(runDir) {
  const p = manifestPath(runDir);
  if (!fs.existsSync(p)) return skeleton();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed.entries) parsed.entries = {};
    if (!parsed.totals) parsed.totals = { images: 0, estUsdTotal: 0, meteredImages: 0 };
    return parsed;
  } catch (_) {
    return skeleton();
  }
}

function recompute(m) {
  const labels = Object.keys(m.entries);
  let estUsdTotal = 0;
  let meteredImages = 0;
  for (const l of labels) {
    const e = m.entries[l];
    estUsdTotal += Number(e.estUsd) || 0;
    if (e.backend !== 'codex-cli') meteredImages += 1;
  }
  m.totals = { images: labels.length, estUsdTotal, meteredImages };
  return m;
}

function atomicWrite(runDir, m) {
  const p = manifestPath(runDir);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  JSON.parse(fs.readFileSync(tmp, 'utf8')); // validate before swap
  fs.renameSync(tmp, p); // POSIX atomic
}

/**
 * @param {string} runDir
 * @param {string} label  e.g. "master" | "scene-01"
 * @param {{backend:string, estUsd:number, redoCount:number, path:string, seed?:number, model?:string, promptHash?:string}} entry
 */
function record(runDir, label, entry) {
  const m = load(runDir);
  m.entries[label] = {
    backend: entry.backend,
    model: entry.model || null,
    path: entry.path,
    seed: entry.seed != null ? entry.seed : null,
    estUsd: Number(entry.estUsd) || 0,
    redoCount: Number(entry.redoCount) || 0,
    promptHash: entry.promptHash || null,
    timestamp: entry.timestamp || new Date().toISOString(),
  };
  recompute(m);
  atomicWrite(runDir, m);
  return m;
}

function bumpRedo(runDir, label) {
  const m = load(runDir);
  if (!m.entries[label]) throw new Error(`bumpRedo: no entry "${label}"`);
  m.entries[label].redoCount = (Number(m.entries[label].redoCount) || 0) + 1;
  atomicWrite(runDir, m);
  return m.entries[label].redoCount;
}

module.exports = { load, record, bumpRedo, manifestPath };
