const test = require('node:test');
const assert = require('node:assert');
const { STAGES, STAGE_PHASE, NEXT_STAGE, parseStopAt, stageRank, resolveStopAction } = require('../scripts/lib/stop-at');

test('STAGES are ordered research<outline<draft<design<full', () => {
  assert.deepStrictEqual(STAGES, ['research', 'outline', 'draft', 'design', 'full']);
});

test('STAGE_PHASE maps each stage to the phase it completes after', () => {
  assert.deepStrictEqual(STAGE_PHASE, {
    research: 3, outline: 4, draft: 5, design: 6, full: 7,
  });
});

test('STAGE_PHASE has an entry for every STAGES element', () => {
  for (const s of STAGES) assert.ok(s in STAGE_PHASE, `${s} missing from STAGE_PHASE`);
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
  assert.strictEqual(stageRank('outline'), 2);
  assert.strictEqual(stageRank('draft'), 3);
  assert.strictEqual(stageRank('design'), 4);
  assert.strictEqual(stageRank('full'), 5);
});

test('stageRank accepts uppercase NONE as the empty sentinel', () => {
  assert.strictEqual(stageRank('NONE'), 0);
});

test('NEXT_STAGE chains research→outline→…→full→null', () => {
  assert.deepStrictEqual(NEXT_STAGE, {
    research: 'outline', outline: 'draft', draft: 'design', design: 'full', full: null,
  });
});

test('fresh run, stop-at=outline → run to outline (Phase 4)', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'none' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.target, 'outline');
  assert.strictEqual(d.stopPhase, 4);
  assert.strictEqual(d.nextStage, 'draft');
});

test('no stop-at defaults to full and runs', () => {
  const d = resolveStopAction({ completed: 'none' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.target, 'full');
  assert.strictEqual(d.stopPhase, 7);
});

test('stop-at <= completed → already-done', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'design' });
  assert.strictEqual(d.action, 'already-done');
  assert.match(d.message, /already complete/i);
});

test('stop-at == completed (equal rank) → already-done', () => {
  const d = resolveStopAction({ stopAt: 'draft', completed: 'draft' });
  assert.strictEqual(d.action, 'already-done');
});

test('stop-at > completed → run (continue from breakpoint)', () => {
  const d = resolveStopAction({ stopAt: 'design', completed: 'outline' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.stopPhase, 6);
});

test('outline already approved → hint to continue design via run-id', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'outline', outlineApproved: true });
  assert.strictEqual(d.action, 'already-done');
  assert.match(d.message, /--run-id=<id> --stop-at=full/);
});

test('invalid stop-at bubbles up from resolveStopAction', () => {
  assert.throws(() => resolveStopAction({ stopAt: 'nope', completed: 'none' }), /Invalid --stop-at/);
});
