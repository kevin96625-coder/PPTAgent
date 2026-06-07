'use strict';
// CLI: node write_style_lock.js --run-dir <RD> --preset <name> --preset-file <yaml> --character-desc-json '<json>'
const fs = require('node:fs');
const path = require('node:path');
const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') { a.runDir = argv[++i]; }
    else if (argv[i] === '--preset') { a.preset = argv[++i]; }
    else if (argv[i] === '--preset-file') { a.presetFile = argv[++i]; }
    else if (argv[i] === '--character-desc-json') { a.characterDescJson = argv[++i]; }
  }
  return a;
}

function parseYamlBlock(text) {
  // Minimal multiline-block YAML reader for the 4 known fields.
  // Handles `|` block scalars. Sufficient for the known flat-cartoon/watercolor/pixar/warm-handdrawn YAML structure.
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let blockLines = null;
  let blockIndent = null;

  for (const line of lines) {
    if (blockLines !== null) {
      // Continuing a block scalar
      if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
        blockLines.push(line);
        continue;
      } else {
        // End of block — flush
        result[currentKey] = blockLines.join('\n').trimEnd();
        blockLines = null;
        blockIndent = null;
        currentKey = null;
      }
    }
    // Check for a block scalar start: `key: |`
    const blockMatch = line.match(/^([a-z_]+):\s*\|\s*$/);
    if (blockMatch) {
      currentKey = blockMatch[1];
      blockLines = [];
      continue;
    }
    // Simple key: value
    const simpleMatch = line.match(/^([a-z_]+):\s*"?([^"]*)"?\s*$/);
    if (simpleMatch) {
      result[simpleMatch[1]] = simpleMatch[2].trim();
    }
  }
  if (currentKey && blockLines) {
    result[currentKey] = blockLines.join('\n').trimEnd();
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
if (!args.runDir || !args.preset || !args.presetFile || !args.characterDescJson) {
  console.error('Usage: write_style_lock.js --run-dir <RD> --preset <name> --preset-file <yaml> --character-desc-json <json>');
  process.exit(1);
}

const rawYaml = fs.readFileSync(args.presetFile, 'utf8');
const presetYaml = parseYamlBlock(rawYaml);
const characterDesc = JSON.parse(args.characterDescJson);
const lock = buildStyleLock({ preset: args.preset, presetYaml, characterDesc });
const paths = writeStyleLock(args.runDir, lock);
console.log(JSON.stringify({ ok: true, paths, style_preset: lock.style_preset, aspect: lock.aspect }));
