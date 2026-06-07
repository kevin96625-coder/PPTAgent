#!/usr/bin/env node
'use strict';

// Thin CLI over scripts/lib/planning-validator.js.
// Usage: node planning-validator-cli.js --outline <path> [--targets <path>] [--pages <min-max>]
// Prints the JSON report to stdout. Exit 0 if no hard errors, exit 1 if hard errors (or bad input).

const fs = require('fs');
const { validateOutline } = require('./lib/planning-validator');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function parsePages(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const n = Number(s);
  return Number.isFinite(n) ? { min: n, max: n } : null;
}

try {
  const outlinePath = arg('--outline');
  if (!outlinePath) throw new Error('--outline <path> is required');
  const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
  const targetsPath = arg('--targets');
  const densityTargets = targetsPath ? JSON.parse(fs.readFileSync(targetsPath, 'utf8')) : {};
  const report = validateOutline(outline, { densityTargets, pagesRange: parsePages(arg('--pages')) });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
  process.exit(1);
}
