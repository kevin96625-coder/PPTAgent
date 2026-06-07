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
