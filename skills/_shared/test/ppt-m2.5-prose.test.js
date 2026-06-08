const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const OUTLINE_ARCH = read('../references/prompts/outline-architect.md');

test('outline-architect documents the asset field + kinds', () => {
  assert.match(OUTLINE_ARCH, /"asset"/);
  assert.match(OUTLINE_ARCH, /brand-entity/);
  assert.match(OUTLINE_ARCH, /\bscene\b/);
  assert.match(OUTLINE_ARCH, /needed/);
  assert.match(OUTLINE_ARCH, /query/);
});

test('outline-architect gives asset-kind assignment guidance', () => {
  assert.match(OUTLINE_ARCH, /封面|cover/);
  assert.match(OUTLINE_ARCH, /brand-entity[\s\S]*?产品|产品[\s\S]*?brand-entity/);
});
