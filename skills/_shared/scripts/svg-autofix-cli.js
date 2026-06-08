#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const { autofixSvg } = require('./lib/svg-autofix');
const argv = process.argv.slice(2);
const inFile = argv[0];
if (!inFile) { console.error('usage: svg-autofix-cli.js <in.svg> [--theme dark] [--tokens <json>] [--out <path>]'); process.exit(2); }
const outIdx = argv.indexOf('--out'); const out = outIdx >= 0 ? argv[outIdx + 1] : inFile;
const tokIdx = argv.indexOf('--tokens'); let tokens = {};
if (tokIdx >= 0) { try { tokens = JSON.parse(argv[tokIdx + 1]); } catch { /* ignore */ } }
const svg = fs.readFileSync(inFile, 'utf8');
const { svg: fixed, fixes } = autofixSvg(svg, { tokens });
fs.writeFileSync(out, fixed);
console.error(`autofix: ${fixes.length} fix(es)`);
console.log(out);
