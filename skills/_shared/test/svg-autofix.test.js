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
