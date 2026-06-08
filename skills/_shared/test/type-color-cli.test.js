const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { parseStyle, parseStyleBlock } = require('../scripts/lib/style-mini-parser');

const CLI = path.join(__dirname, '../scripts/type-color-cli.js');
const BUSINESS = path.join(__dirname, '../references/styles/business.yaml');

// ---- mini YAML parser unit tests ----

test('mini-parser extracts color_scheme leaf hexes', () => {
  const text = `color_scheme:
  primary: "#1a365d"      # Deep navy
  accent: "#e67e22"
  chart_colors:
    - "#e67e22"
    - "#2d5f8a"
typography:
  scale: 1.0`;
  const cs = parseStyleBlock(text, 'color_scheme');
  assert.equal(cs.primary, '#1a365d');
  assert.equal(cs.accent, '#e67e22');
  assert.deepEqual(cs.chart_colors, ['#e67e22', '#2d5f8a']);
});

test('mini-parser extracts typography_ladder numbers', () => {
  const text = `typography_ladder:
  h1: 64        # cover
  h2: 40
  body: 18
  micro: 12`;
  const t = parseStyleBlock(text, 'typography_ladder');
  assert.equal(t.h1, 64);
  assert.equal(t.body, 18);
  assert.equal(t.micro, 12);
});

test('mini-parser extracts color_ratio with nested buckets (flow lists)', () => {
  const text = `color_ratio:
  dominant: 60
  secondary: 30
  accent: 10
  buckets:
    dominant: [background]
    secondary: [primary, secondary, card_bg, text]
    accent: [accent]`;
  const cr = parseStyleBlock(text, 'color_ratio');
  assert.equal(cr.dominant, 60);
  assert.deepEqual(cr.buckets.dominant, ['background']);
  assert.deepEqual(cr.buckets.secondary, ['primary', 'secondary', 'card_bg', 'text']);
  assert.deepEqual(cr.buckets.accent, ['accent']);
});

test('mini-parser returns null for absent block, never throws', () => {
  assert.equal(parseStyleBlock('name: foo\n', 'color_ratio'), null);
  assert.doesNotThrow(() => parseStyle('not: valid: yaml: :::'));
});

test('parseStyle reads real business.yaml (after P3 fields added)', () => {
  const text = fs.readFileSync(BUSINESS, 'utf8');
  const s = parseStyle(text);
  assert.ok(s.colorScheme && s.colorScheme.background, 'has color_scheme');
  // These exist once Task 4 has appended them:
  assert.ok(s.typographyLadder && s.typographyLadder.h1 === 64, 'has typography_ladder');
  assert.ok(s.colorRatio && s.colorRatio.buckets, 'has color_ratio.buckets');
});

// ---- CLI tests ----

test('CLI emits {typeScale,colorRatio} JSON and exits 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-'));
  const svg = path.join(dir, 's.svg');
  fs.writeFileSync(svg, `<svg viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ffffff"/><text font-size="40">T</text></svg>`);
  const r = spawnSync('node', [CLI, '--svg', svg, '--style', BUSINESS], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(out.typeScale && Array.isArray(out.typeScale.warnings));
  assert.ok(out.colorRatio && 'caveat' in out.colorRatio);
});

test('CLI exits 0 even on missing/garbage inputs', () => {
  const r1 = spawnSync('node', [CLI, '--svg', '/no/such/file.svg', '--style', '/no/such/style.yaml'], { encoding: 'utf8' });
  assert.equal(r1.status, 0);
  const r2 = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(r2.status, 0);
});
