const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const targets = require('../references/density-targets.json');
const REVIEWER = fs.readFileSync(
  path.join(__dirname, '../../gemini-cli/references/roles/reviewer.md'), 'utf8');

test('density-targets has the 6 page-type keys', () => {
  for (const t of ['quote', 'image', 'content', 'data', 'comparison', 'process']) {
    assert.ok(targets[t], `missing target for ${t}`);
    assert.ok(Array.isArray(targets[t].target_info_units) && targets[t].target_info_units.length === 2);
    assert.strictEqual(typeof targets[t].max_key_points, 'number');
  }
});

test('reviewer.md still documents Content Density Targets and points to the JSON', () => {
  assert.match(REVIEWER, /Content Density Targets/);
  assert.match(REVIEWER, /density-targets\.json/);
});

test('reviewer.md per-type rows match density-targets.json values', () => {
  for (const t of ['quote', 'image', 'content', 'data', 'comparison', 'process']) {
    const [min, max] = targets[t].target_info_units;
    const row = new RegExp(`\\|\\s*${t}\\s*\\|\\s*${min}-${max}\\b`);
    assert.match(REVIEWER, row, `reviewer.md row for ${t} should show ${min}-${max} matching the JSON`);
  }
});

test('reviewer.md per-type rows reflect max_key_points from density-targets.json', () => {
  const lines = REVIEWER.split('\n');
  for (const t of ['quote', 'image', 'content', 'data', 'comparison', 'process']) {
    const [min, max] = targets[t].target_info_units;
    // find the table row for this type (starts with | type | min-max |)
    const row = lines.find((l) => new RegExp(`^\\|\\s*${t}\\s*\\|\\s*${min}-${max}\\b`).test(l));
    assert.ok(row, `reviewer.md should have a row for ${t}`);
    // the max_key_points value must appear somewhere in that row's text
    assert.ok(
      row.includes(String(targets[t].max_key_points)),
      `reviewer.md ${t} row should reflect max_key_points ${targets[t].max_key_points}: "${row}"`
    );
  }
});
