#!/usr/bin/env node
'use strict';

// Thin CLI over scripts/lib/reference-selector.js. Prints a JSON {ids,reason} to
// stdout. ALWAYS exits 0 — a bad/missing index or page degrades to empty ids.
//
// Usage:
//   node reference-selector-cli.js --type data --layout dashboard \
//        --data-elements chart,metric [--has-asset true] \
//        [--index skills/_shared/index.json] [--cap 4]

const fs = require('node:fs');
const path = require('node:path');
const { selectReferences } = require('./lib/reference-selector');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function loadIndex(p) {
  try {
    const file = p || path.join(__dirname, '..', 'index.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return undefined; // selector degrades gracefully to empty ids
  }
}

const dataElementsRaw = arg('--data-elements', '');
const dataElements = dataElementsRaw
  ? dataElementsRaw.split(',').map((s) => ({ type: s.trim() })).filter((e) => e.type)
  : [];

const capRaw = arg('--cap', undefined);
const cap = capRaw !== undefined ? parseInt(capRaw, 10) : undefined;

const result = selectReferences(
  {
    type: arg('--type', undefined),
    layout_type: arg('--layout', undefined),
    data_elements: dataElements,
    has_asset: arg('--has-asset', 'false') === 'true',
  },
  { index: loadIndex(arg('--index', undefined)), cap }
);

process.stdout.write(JSON.stringify(result) + '\n');
process.exit(0);
