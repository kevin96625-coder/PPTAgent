const test = require('node:test');
const assert = require('node:assert');
const { autofixSvg } = require('../scripts/lib/svg-autofix');

const TOK = { primary: '#0f172a', background: '#0f172a', card_bg: '#1e293b', accent: '#22d3ee', text: '#f1f5f9' };

test('font-size below 14 is raised to 14', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text x="60" y="100" font-size="11" fill="#f1f5f9">hi</text></svg>`;
  const { svg: out, fixes } = autofixSvg(svg, { tokens: TOK });
  assert.match(out, /font-size="14"/);
  assert.ok(fixes.some((f) => f.type === 'font-floor'));
});
test('data-role=label uses 12 floor', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text data-role="label" font-size="9" fill="#f1f5f9">x</text></svg>`;
  const { svg: out } = autofixSvg(svg, { tokens: TOK });
  assert.match(out, /font-size="12"/);
});
test('font-size >= 14 untouched, no fixes, bytes stable', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text font-size="20" fill="#f1f5f9">x</text></svg>`;
  const { svg: out, fixes } = autofixSvg(svg, { tokens: TOK });
  assert.equal(out, svg);
  assert.equal(fixes.length, 0);
});

test('dark theme: low-contrast text fill is lightened to >=3:1', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text x="60" y="100" font-size="34" fill="#6366f1">T</text></svg>`;
  const { svg: out, fixes } = autofixSvg(svg, { tokens: TOK });
  const m = out.match(/fill="(#[0-9a-fA-F]{6})"/);
  const { contrastRatio } = require('../scripts/lib/color-contrast');
  assert.ok(contrastRatio(m[1], '#0f172a') >= 3, `fill ${m[1]}`);
  assert.ok(fixes.some((f) => f.type === 'contrast'));
});
test('decorative + non-text fills are NOT touched', () => {
  const svg = `<svg viewBox="0 0 1280 720"><rect fill="#6366f1"/><g data-decorative="true"><text fill="#6366f1" font-size="20">d</text></g></svg>`;
  const { svg: out } = autofixSvg(svg, { tokens: TOK });
  assert.ok((out.match(/#6366f1/g) || []).length === 2, 'rect + decorative text untouched');
});
test('passing fill unchanged', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text fill="#f1f5f9" font-size="20">x</text></svg>`;
  const { svg: out, fixes } = autofixSvg(svg, { tokens: TOK });
  assert.equal(out, svg);
  assert.ok(!fixes.some((f) => f.type === 'contrast'));
});

test('top-level title with low baseline is clamped to y>=92', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text data-role="title" x="60" y="70" font-size="34" fill="#f1f5f9">T</text></svg>`;
  const { svg: out, fixes } = autofixSvg(svg, { tokens: TOK });
  assert.match(out, /data-role="title"[^>]*y="92"|y="92"[^>]*data-role="title"/);
  assert.ok(fixes.some((f) => f.type === 'safe-area'));
});
test('NESTED title (inside transformed g) is NOT moved', () => {
  const svg = `<svg viewBox="0 0 1280 720"><g transform="translate(0,200)"><text data-role="title" x="60" y="14" font-size="34" fill="#f1f5f9">T</text></g></svg>`;
  const { svg: out } = autofixSvg(svg, { tokens: TOK });
  assert.match(out, /y="14"/); // unchanged — local coords are legitimate
});
test('top-level page-number below 688 clamped up', () => {
  const svg = `<svg viewBox="0 0 1280 720"><text data-role="page-number" x="1240" y="705" font-size="14" fill="#f1f5f9">06</text></svg>`;
  const { svg: out } = autofixSvg(svg, { tokens: TOK });
  assert.match(out, /y="688"/);
  assert.match(out, /x="1220"/);
});
