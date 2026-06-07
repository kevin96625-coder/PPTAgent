#!/usr/bin/env node
'use strict';

// Thin CLI over scripts/lib/stop-at.js. Prints a JSON decision to stdout.
// Usage: node stop-at-cli.js --stop-at <v> [--completed <stage>] [--outline-approved <true|false>]
// Exit 0 with JSON on success; exit 1 with { "error": "..." } on invalid flag.

const { resolveStopAction } = require('./lib/stop-at');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

try {
  const decision = resolveStopAction({
    stopAt: arg('--stop-at', undefined),
    completed: arg('--completed', 'none'),
    outlineApproved: arg('--outline-approved', 'false') === 'true',
  });
  process.stdout.write(JSON.stringify(decision) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
  process.exit(1);
}
