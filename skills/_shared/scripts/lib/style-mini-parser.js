'use strict';
// Minimal, dependency-free reader for the THREE style-YAML blocks P3 needs:
//   color_scheme, typography_ladder, color_ratio.
//
// There is NO yaml dependency in this repo and we must not add one. The style
// files use a small, regular subset of YAML:
//   - top-level `key:` introduces a 2-space-indented block
//   - leaf entries are `name: "#hex"` or `name: 64` (with optional `# comment`)
//   - nested maps go one level deeper (color_ratio.buckets)
//   - flow lists `[a, b, c]` and block lists `- "#hex"`
// This parser handles exactly that subset and ignores everything else. It never
// throws — on any malformed input it returns whatever it parsed so far.

function stripComment(s) {
  // Remove an unquoted trailing `# comment`. Quotes in style files are simple
  // (no '#' inside hex/font values) so a quote-aware scan is sufficient.
  let inQuote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuote) { if (c === inQuote) inQuote = null; continue; }
    if (c === '"' || c === "'") { inQuote = c; continue; }
    if (c === '#') return s.slice(0, i);
  }
  return s;
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Parse a scalar: number if it looks numeric, else unquoted string.
function scalar(v) {
  const u = unquote(v);
  if (/^-?\d+(\.\d+)?$/.test(u)) return parseFloat(u);
  return u;
}

// Parse a flow list `[a, "b", c]` -> array of scalars.
function flowList(v) {
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map((x) => scalar(x.trim()));
}

function indentOf(line) {
  const m = line.match(/^( *)/);
  return m[1].length;
}

// Extract one top-level block named `blockName`. Returns the array of its
// member lines (with original indentation) or null if absent.
function blockLines(text, blockName) {
  const lines = String(text).split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^${blockName}\\s*:\\s*$`).test(stripComment(lines[i]))) { start = i; break; }
  }
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) { out.push(raw); continue; }      // keep blank lines for nesting context
    if (indentOf(raw) === 0) break;                     // next top-level key ends the block
    out.push(raw);
  }
  return out;
}

// Parse a (possibly nested) block of `key: value` / `key:`+children / `- item`.
// `baseIndent` is the indentation level of this block's direct children.
function parseBlock(lines, baseIndent) {
  const obj = {};
  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    const ind = indentOf(raw);
    if (ind !== baseIndent) continue; // only direct children at this level
    const body = raw.slice(baseIndent);

    // Block list item under the previous key is handled by the key branch below.
    const kv = body.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();

    if (val === '') {
      // Nested block or block list: gather deeper-indented lines.
      const child = [];
      let childIndent = -1;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const r2 = lines[j];
        if (!r2.trim()) { child.push(r2); continue; }
        const ci = indentOf(r2);
        if (ci <= baseIndent) break;
        if (childIndent === -1) childIndent = ci;
        child.push(r2);
      }
      // Determine: block list (lines start with `-`) vs nested map.
      const firstReal = child.find((l) => l.trim());
      if (firstReal && stripComment(firstReal).trim().startsWith('- ')) {
        obj[key] = child
          .map((l) => stripComment(l).trim())
          .filter((l) => l.startsWith('- '))
          .map((l) => scalar(l.slice(2).trim()));
      } else {
        obj[key] = parseBlock(child, childIndent === -1 ? baseIndent + 2 : childIndent);
      }
      i = j - 1;
    } else if (val.startsWith('[')) {
      obj[key] = flowList(val);
    } else {
      obj[key] = scalar(val);
    }
  }
  return obj;
}

function parseStyleBlock(text, blockName) {
  const lines = blockLines(text, blockName);
  if (!lines) return null;
  const firstReal = lines.find((l) => l.trim());
  const base = firstReal ? indentOf(firstReal) : 2;
  return parseBlock(lines, base);
}

// Read color_scheme, typography_ladder, color_ratio from a style YAML string.
function parseStyle(text) {
  let colorScheme = null, typographyLadder = null, colorRatio = null;
  try { colorScheme = parseStyleBlock(text, 'color_scheme'); } catch { /* degrade */ }
  try { typographyLadder = parseStyleBlock(text, 'typography_ladder'); } catch { /* degrade */ }
  try { colorRatio = parseStyleBlock(text, 'color_ratio'); } catch { /* degrade */ }
  return { colorScheme, typographyLadder, colorRatio };
}

module.exports = { parseStyle, parseStyleBlock };
