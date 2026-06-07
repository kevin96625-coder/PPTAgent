'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('package.json exists and declares commonjs with correct name', () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(pkg.type, 'commonjs');
  assert.strictEqual(pkg.name, 'bible-class');
  assert.ok(pkg.scripts && pkg.scripts.test, 'scripts.test must exist');
});
