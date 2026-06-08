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

const SLIDE_CORE = read('../../../agents/slide-core.md');

test('slide-core no longer bans external images outright', () => {
  // The absolute ban line must be gone / qualified.
  assert.doesNotMatch(SLIDE_CORE, /No external image references — all graphics must be inline SVG\./);
});

test('slide-core allows <image> on asset pages and forbids fake products', () => {
  assert.match(SLIDE_CORE, /<image[\s>]/);
  assert.match(SLIDE_CORE, /asset\.needed|asset pages|资产页/);
  assert.match(SLIDE_CORE, /needs_real_image/);
  assert.match(SLIDE_CORE, /不.*手绘|do not.*draw.*fake|禁.*假/i);
});

test('slide-core defines image-led layout recipes', () => {
  assert.match(SLIDE_CORE, /full-bleed|出血/i);
  assert.match(SLIDE_CORE, /scrim|蒙版|渐变遮罩/i);
  assert.match(SLIDE_CORE, /分栏|split|图文/i);
});

test('slide-core specifies relative-path image embedding', () => {
  assert.match(SLIDE_CORE, /images\//);
  assert.match(SLIDE_CORE, /href=/);
});
