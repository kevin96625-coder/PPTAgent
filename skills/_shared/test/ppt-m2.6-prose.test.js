const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const SLIDE = read('../../../agents/slide-core.md');

test('slide-core tags title/page-number/label with data-role', () => {
  assert.match(SLIDE, /data-role="title"/);
  assert.match(SLIDE, /data-role="page-number"/);
  assert.match(SLIDE, /data-role="label"/);
});
test('slide-core runs svg-autofix after generation, before validation', () => {
  assert.match(SLIDE, /svg-autofix/);
  // autofix must precede the existing Post-Generation Validation in document order
  const aIdx = SLIDE.search(/svg-autofix/);
  const vIdx = SLIDE.search(/Post-Generation Validation/);
  assert.ok(aIdx > -1 && vIdx > -1 && aIdx < vIdx, 'autofix step before validation');
});
