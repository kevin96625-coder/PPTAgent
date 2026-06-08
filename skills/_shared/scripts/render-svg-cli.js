#!/usr/bin/env node
'use strict';
const { renderSvg } = require('./lib/render-svg');
const [, , svg, png] = process.argv;
if (!svg || !png) { console.error('usage: render-svg-cli.js <in.svg> <out.png>'); process.exit(2); }
const r = renderSvg(svg, png);
if (!r.ok) { console.error(`render failed: ${r.reason}`); process.exit(1); }
console.log(png);
