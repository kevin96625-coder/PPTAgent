#!/usr/bin/env node
'use strict';
// P3 advisory CLI: runs the type-scale + color-ratio analyzers over an SVG using
// a style YAML for the ladder / color tokens / 60-30-10 buckets.
//
// IRON RULE: this CLI is READ-ONLY and ADVISORY. It NEVER rewrites the SVG. Its
// exit code is ALWAYS 0 — soft warnings must never fail CI or make the
// orchestrator think the slide is broken. Bad/missing inputs degrade to an
// empty report, still exit 0.
//
// Usage: type-color-cli.js --svg <path> --style <style.yaml> [--effective-scale <n>]
//        --> JSON { typeScale, colorRatio } on stdout, exit 0.

const fs = require('node:fs');
const { analyzeTypeScale, DEFAULT_LADDER } = require('./lib/type-scale');
const { analyzeColorRatio } = require('./lib/color-ratio');
const { parseStyle } = require('./lib/style-mini-parser');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function safeRead(p) {
  try { return p ? fs.readFileSync(p, 'utf8') : ''; } catch { return ''; }
}

function main() {
  const svgPath = arg('--svg');
  const stylePath = arg('--style');
  const esRaw = arg('--effective-scale');
  const effectiveScale = esRaw != null && /^-?\d+(\.\d+)?$/.test(esRaw) ? parseFloat(esRaw) : undefined;

  const svg = safeRead(svgPath);
  const styleText = safeRead(stylePath);

  let style = { colorScheme: null, typographyLadder: null, colorRatio: null };
  try { style = parseStyle(styleText); } catch { /* degrade to empty */ }

  const ladderObj = style.typographyLadder && Object.keys(style.typographyLadder).length
    ? style.typographyLadder
    : DEFAULT_LADDER;

  let typeScale, colorRatio;
  try {
    typeScale = analyzeTypeScale(svg, { ladder: ladderObj, effectiveScale });
  } catch (e) {
    typeScale = { distinctSizes: 0, sizes: [], offLadder: [], warnings: [{ code: 'cli-error', level: 'info', detail: String(e && e.message || e) }] };
  }
  try {
    colorRatio = analyzeColorRatio(svg, { colorScheme: style.colorScheme || {}, colorRatio: style.colorRatio || {} });
  } catch (e) {
    colorRatio = { insufficient_area: true, distribution: { dominant: 0, secondary: 0, accent: 0, other: 0 }, warnings: [{ code: 'cli-error', level: 'info', detail: String(e && e.message || e) }], caveat: '' };
  }

  process.stdout.write(JSON.stringify({ typeScale, colorRatio }, null, 2) + '\n');
}

try { main(); } catch (e) {
  // Last-resort guard: still emit a JSON shell and exit 0.
  try { process.stdout.write(JSON.stringify({ typeScale: null, colorRatio: null, error: String(e && e.message || e) }) + '\n'); } catch { /* noop */ }
}
process.exit(0);
