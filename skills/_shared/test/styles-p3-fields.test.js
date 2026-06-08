const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseStyleBlock } = require('../scripts/lib/style-mini-parser');

// P3 adds typography_ladder + color_ratio to every top-level style YAML (the
// ones that carry a `color_scheme` block whose tokens the buckets reference).
// Children image-gen styles use a different schema and are intentionally excluded.
const STYLES_DIR = path.join(__dirname, '../references/styles');
const LADDER_KEYS = ['h1', 'h2', 'h3', 'body', 'label', 'caption', 'micro'];

const files = fs.readdirSync(STYLES_DIR).filter((f) => f.endsWith('.yaml'));

test('there are style files to check', () => {
  assert.ok(files.length >= 17, `expected >=17 styles, got ${files.length}`);
});

for (const f of files) {
  test(`${f} has a complete typography_ladder (7 keys) + color_ratio (3 buckets)`, () => {
    const text = fs.readFileSync(path.join(STYLES_DIR, f), 'utf8');

    const ladder = parseStyleBlock(text, 'typography_ladder');
    assert.ok(ladder, `${f}: missing typography_ladder`);
    for (const k of LADDER_KEYS) {
      assert.equal(typeof ladder[k], 'number', `${f}: typography_ladder.${k} should be a number`);
    }

    const ratio = parseStyleBlock(text, 'color_ratio');
    assert.ok(ratio, `${f}: missing color_ratio`);
    assert.equal(ratio.dominant, 60, `${f}: color_ratio.dominant`);
    assert.equal(ratio.secondary, 30, `${f}: color_ratio.secondary`);
    assert.equal(ratio.accent, 10, `${f}: color_ratio.accent`);
    assert.ok(ratio.buckets, `${f}: missing color_ratio.buckets`);
    assert.deepEqual(ratio.buckets.dominant, ['background'], `${f}: buckets.dominant`);
    assert.ok(Array.isArray(ratio.buckets.secondary) && ratio.buckets.secondary.length >= 1, `${f}: buckets.secondary`);
    assert.deepEqual(ratio.buckets.accent, ['accent'], `${f}: buckets.accent`);
  });
}
