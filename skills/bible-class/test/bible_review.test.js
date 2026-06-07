const test = require('node:test');
const assert = require('node:assert');
const { parseReviewFlags, CHECKLIST } = require('../lib/bible_review');

const SAMPLE_REVIEW = `
## Bible Review — Scene 03

[CRITICAL] scene:scene-03 — A wristwatch is visible on Jesus's wrist (anachronism: modern object)
[MAJOR] scene:scene-02 — The cross symbol appears on a robe (anachronism: not used until post-resurrection)
[MINOR] scene:scene-01 — Background includes a building that resembles a modern house
[OK] scene:master — Character appearance is period-appropriate and reverent
Some other narrative text that should be ignored.
`;

test('parseReviewFlags extracts all flagged lines', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags.length, 4);
});

test('parseReviewFlags correctly extracts severity', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags[0].severity, 'CRITICAL');
  assert.strictEqual(flags[1].severity, 'MAJOR');
  assert.strictEqual(flags[2].severity, 'MINOR');
  assert.strictEqual(flags[3].severity, 'OK');
});

test('parseReviewFlags correctly extracts scene label', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags[0].scene, 'scene-03');
  assert.strictEqual(flags[1].scene, 'scene-02');
  assert.strictEqual(flags[3].scene, 'master');
});

test('parseReviewFlags correctly extracts issue description', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.match(flags[0].issue, /wristwatch/);
  assert.match(flags[1].issue, /cross symbol/);
});

test('parseReviewFlags returns empty array on empty input', () => {
  assert.deepStrictEqual(parseReviewFlags(''), []);
  assert.deepStrictEqual(parseReviewFlags(null), []);
  assert.deepStrictEqual(parseReviewFlags(undefined), []);
});

test('parseReviewFlags ignores non-flag lines', () => {
  const flags = parseReviewFlags('This is a paragraph with no flags.\nAnother line.');
  assert.strictEqual(flags.length, 0);
});

test('parseReviewFlags handles severity case-insensitively', () => {
  const flags = parseReviewFlags('[critical] scene:scene-01 — lowercase severity test');
  assert.strictEqual(flags.length, 1);
  assert.strictEqual(flags[0].severity, 'CRITICAL');
});

test('CHECKLIST is an array with 4 required check IDs', () => {
  assert.ok(Array.isArray(CHECKLIST));
  const ids = CHECKLIST.map((c) => c.id);
  assert.ok(ids.includes('anachronism'), 'must include anachronism check');
  assert.ok(ids.includes('faithfulness'), 'must include faithfulness check');
  assert.ok(ids.includes('reverence'), 'must include reverence check');
  assert.ok(ids.includes('period-setting'), 'must include period-setting check');
});

test('each CHECKLIST item has id, label, and description strings', () => {
  for (const item of CHECKLIST) {
    assert.ok(typeof item.id === 'string' && item.id.length > 0, `item.id must be a non-empty string`);
    assert.ok(typeof item.label === 'string' && item.label.length > 0, `item.label must be a non-empty string`);
    assert.ok(typeof item.description === 'string' && item.description.length > 0, `item.description must be a non-empty string`);
  }
});
