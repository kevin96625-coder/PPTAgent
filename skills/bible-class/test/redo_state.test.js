const test = require('node:test');
const assert = require('node:assert');
const { nextRedo, REDO_LIMIT } = require('../lib/redo_state');

test('REDO_LIMIT is 3', () => {
  assert.strictEqual(REDO_LIMIT, 3);
});

test('nextRedo returns redoCount=1 for first redo on a fresh label', () => {
  const approvals = {};
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.approved, false);
  assert.strictEqual(result.redoCount, 1);
  assert.strictEqual(result.limitReached, false);
});

test('nextRedo increments redoCount on existing unapproved label', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.redoCount, 2);
  assert.strictEqual(result.limitReached, false);
});

test('nextRedo sets limitReached=true when redoCount would reach REDO_LIMIT', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 2 } };
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.redoCount, 3);
  assert.strictEqual(result.limitReached, true);
});

test('nextRedo throws when redo count already at or above limit', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 3 } };
  assert.throws(() => nextRedo(approvals, 'scene-01'), /limit/i);
});

test('nextRedo is pure — does not mutate the approvals object', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const before = JSON.stringify(approvals);
  nextRedo(approvals, 'scene-01');
  assert.strictEqual(JSON.stringify(approvals), before);
});

test('nextRedo throws on already-approved label', () => {
  const approvals = { 'scene-01': { approved: true, redoCount: 0 } };
  assert.throws(() => nextRedo(approvals, 'scene-01'), /approved/i);
});

test('nextRedo handles multiple independent labels without cross-contamination', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const r2 = nextRedo(approvals, 'scene-02');
  assert.strictEqual(r2.redoCount, 1);  // scene-02 is fresh
  const r1 = nextRedo(approvals, 'scene-01');
  assert.strictEqual(r1.redoCount, 2);  // scene-01 was at 1
});
