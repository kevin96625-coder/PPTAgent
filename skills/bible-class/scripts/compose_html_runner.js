#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');

const runDir = process.argv[2];
if (!runDir) { console.error('Usage: compose_html_runner.js <run-dir>'); process.exit(1); }

const { composeStorybookHtml } = require(path.resolve(__dirname, '..', 'lib', 'html_compose'));
const outline = JSON.parse(fs.readFileSync(path.join(runDir, 'lesson-outline.json'), 'utf8'));
const files = composeStorybookHtml({
  outline,
  imagesDir: path.join(runDir, 'images'),
  slidesDir: path.join(runDir, 'slides'),
});
console.log('Wrote', files.length, 'slide HTML files');
files.forEach(f => console.log(' ', f));
