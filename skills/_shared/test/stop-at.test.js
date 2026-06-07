const test = require('node:test');
const assert = require('node:assert');
const { STAGES, STAGE_PHASE, parseStopAt, stageRank } = require('../scripts/lib/stop-at');

test('STAGES are ordered research<outline<draft<design<full', () => {
  assert.deepStrictEqual(STAGES, ['research', 'outline', 'draft', 'design', 'full']);
});

test('STAGE_PHASE maps each stage to the phase it completes after', () => {
  assert.deepStrictEqual(STAGE_PHASE, {
    research: 3, outline: 4, draft: 5, design: 6, full: 7,
  });
});

test('parseStopAt defaults empty/undefined to full', () => {
  assert.strictEqual(parseStopAt(undefined), 'full');
  assert.strictEqual(parseStopAt(''), 'full');
  assert.strictEqual(parseStopAt('  '), 'full');
});

test('parseStopAt normalizes case/whitespace', () => {
  assert.strictEqual(parseStopAt(' Outline '), 'outline');
  assert.strictEqual(parseStopAt('DESIGN'), 'design');
});

test('parseStopAt rejects unknown values with a helpful message', () => {
  assert.throws(() => parseStopAt('slides'), /Invalid --stop-at "slides".*research, outline, draft, design, full/s);
});

test('stageRank: none=0, research=1 ... full=5', () => {
  assert.strictEqual(stageRank('none'), 0);
  assert.strictEqual(stageRank(undefined), 0);
  assert.strictEqual(stageRank('research'), 1);
  assert.strictEqual(stageRank('full'), 5);
});
