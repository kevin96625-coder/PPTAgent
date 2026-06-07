'use strict';

// Pure validation of outline.json for the /ppt Phase 4 quality gate. No I/O.
// Hard errors block the workflow; soft warnings are surfaced at the Hard Stop.

const PAGE_TYPES = ['content', 'data', 'comparison', 'process', 'quote', 'image'];
const VISUAL_WEIGHTS = ['low', 'medium', 'high'];
const END_PAGE_TYPES = ['thank_you', 'call_to_action', 'contact', 'q_and_a'];
const LAYOUT_TYPES = [
  'single_focus', 'two_column_symmetric', 'two_column_asymmetric', 'three_column',
  'hero_grid', 'mixed_grid', 'timeline', 'dashboard', 'horizontal_split', 'full_bleed',
];

function countDataElements(de) {
  if (Array.isArray(de)) return de.length;
  if (typeof de === 'number') return de;
  if (de && typeof de === 'object') return Object.keys(de).length;
  return 0;
}

function collectPages(outline) {
  const pages = [];
  for (const part of (outline.parts || [])) {
    if (!part || typeof part !== 'object') continue;
    for (const pg of (part.pages || [])) {
      if (pg && typeof pg === 'object') pages.push(pg);
    }
  }
  return pages;
}

function consecutiveRuns(pages, keyFn, maxRun, cb) {
  let i = 0;
  while (i < pages.length) {
    const val = keyFn(pages[i]);
    let j = i;
    while (j + 1 < pages.length && val != null && keyFn(pages[j + 1]) === val) j++;
    const runLen = j - i + 1;
    if (val != null && runLen > maxRun) {
      const a = pages[i].index != null ? pages[i].index : i + 1;
      const b = pages[j].index != null ? pages[j].index : j + 1;
      cb(val, `${a}-${b}`);
    }
    i = j + 1;
  }
}

/**
 * @param {object} outline parsed outline.json
 * @param {{densityTargets?:object, pagesRange?:{min:number,max:number}}} opts
 * @returns {{ok:boolean, hard_errors:Array, warnings:Array, summary:object}}
 */
function validateOutline(outline, opts = {}) {
  const targets = opts.densityTargets || {};
  const pagesRange = opts.pagesRange || null;
  const hard = [];
  const warn = [];
  const E = (page, field, msg) => hard.push({ page: page == null ? null : page, field, msg });
  const W = (page, kind, severity, msg) => warn.push({ page: page == null ? null : page, kind, severity, msg });
  const o = outline || {};

  for (const f of ['title', 'total_pages', 'approved', 'cover', 'parts', 'end_page']) {
    if (!(f in o)) E(null, f, `missing required top-level field "${f}"`);
  }

  if (!Array.isArray(o.parts)) {
    E(null, 'parts', 'parts must be an array');
    return finalize();
  }

  if (o.end_page && typeof o.end_page === 'object') {
    if (!('type' in o.end_page)) {
      E(null, 'end_page.type', 'end_page is missing required field "type"');
    } else if (!END_PAGE_TYPES.includes(o.end_page.type)) {
      E(null, 'end_page.type', `invalid end_page.type "${o.end_page.type}" (allowed: ${END_PAGE_TYPES.join(', ')})`);
    }
  }

  const pages = collectPages(o);

  // Malformed (non-object) parts/pages are a hard error (not just silently skipped).
  (o.parts || []).forEach((part, i) => {
    if (!part || typeof part !== 'object') { E(null, `parts[${i}]`, `part ${i + 1} is not an object`); return; }
    (part.pages || []).forEach((pg, j) => {
      if (!pg || typeof pg !== 'object') E(null, `parts[${i}].pages[${j}]`, `page ${j + 1} in part ${i + 1} is not an object`);
    });
  });

  pages.forEach((pg, i) => {
    const id = pg.index != null ? pg.index : `#${i + 1}`;
    for (const f of ['index', 'title', 'type', 'key_points']) {
      if (!(f in pg)) E(id, f, `page missing required field "${f}"`);
    }
    if ('key_points' in pg && !Array.isArray(pg.key_points)) E(id, 'key_points', 'key_points must be an array');
    if ('type' in pg && !PAGE_TYPES.includes(pg.type)) {
      E(id, 'type', `invalid type "${pg.type}" (allowed: ${PAGE_TYPES.join(', ')})`);
    }
    if ('visual_weight' in pg) {
      if (!VISUAL_WEIGHTS.includes(pg.visual_weight)) E(id, 'visual_weight', `invalid visual_weight "${pg.visual_weight}"`);
    } else {
      W(id, 'visual_weight', 'warn', 'missing visual_weight (downstream defaults to medium)');
    }

    const layout = pg.layout_type != null ? pg.layout_type : pg.layout_hint;
    if (layout == null) W(id, 'layout', 'warn', 'missing layout_type');
    else if (!LAYOUT_TYPES.includes(layout)) W(id, 'layout', 'warn', `layout "${layout}" not in the 10 canonical layout_type values`);

    if (PAGE_TYPES.includes(pg.type) && Array.isArray(pg.key_points) && targets[pg.type]) {
      const t = targets[pg.type];
      const kp = pg.key_points.length;
      const units = kp + countDataElements(pg.data_elements);
      // Bullet-budget warn only applies to types with a positive key_points budget.
      // quote/image have max_key_points 0 (their 1-2 info units are a quote/caption, not
      // bullets) — a legitimate 1-2 line accent must NOT warn here; their overload is
      // caught by the units>3 critical below instead.
      if (t.max_key_points > 0 && kp > t.max_key_points) {
        W(id, 'density', 'warn', `${kp} key_points exceeds ${pg.type} max_key_points ${t.max_key_points}`);
      }
      const maxUnits = t.target_info_units[1];
      if ((pg.type === 'quote' || pg.type === 'image') && units > 3) {
        // reviewer.md: a low-density page (quote/image) with >3 units is Critical.
        W(id, 'density', 'critical', `${pg.type} page is over its low-density budget (info_units=${units}; ${pg.type} pages should stay within ~${maxUnits})`);
      } else if (units > maxUnits + 2) {
        W(id, 'density', 'major', `info_units ${units} exceeds ${pg.type} target max ${maxUnits} by >2`);
      }
    }
  });

  const indices = pages.map((p) => p.index);
  const numeric = indices.filter((x) => typeof x === 'number');
  let contiguityOk = numeric.length === pages.length;
  const sorted = [...numeric].sort((a, b) => a - b);
  const seen = new Set();
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k] !== k + 1 || seen.has(sorted[k])) contiguityOk = false;
    seen.add(sorted[k]);
  }
  if (!contiguityOk) E(null, 'index', `page index must be contiguous 1..${pages.length} with no gaps/duplicates (got [${indices.join(', ')}])`);

  if (typeof o.total_pages === 'number' && o.total_pages !== pages.length) {
    E(null, 'total_pages', `total_pages ${o.total_pages} != actual page count ${pages.length}`);
  }
  if (pagesRange && typeof o.total_pages === 'number' && (o.total_pages < pagesRange.min || o.total_pages > pagesRange.max)) {
    E(null, 'total_pages', `total_pages ${o.total_pages} outside requested range ${pagesRange.min}-${pagesRange.max}`);
  }

  consecutiveRuns(pages, (p) => (p.layout_type != null ? p.layout_type : p.layout_hint), 3,
    (val, span) => W(null, 'layout_diversity', 'warn', `pages ${span} all use layout "${val}" (>3 consecutive — monotonous)`));
  consecutiveRuns(pages, (p) => p.visual_weight, 3,
    (val, span) => { if (val === 'high') W(null, 'visual_weight_rhythm', 'warn', `pages ${span} all visual_weight high (>3 consecutive)`); });

  (o.parts || []).forEach((part, i) => {
    if (!part || typeof part !== 'object') return;
    if (!part.key_message || !String(part.key_message).trim()) {
      W(null, 'key_message', 'warn', `part ${i + 1} ("${part.title || ''}") has no key_message`);
    }
  });

  return finalize();

  function finalize() {
    const pageCount = (o.parts || []).reduce((n, p) => n + (p && typeof p === 'object' ? (p.pages || []).length : 0), 0);
    return {
      ok: hard.length === 0,
      hard_errors: hard,
      warnings: warn,
      summary: { pages: pageCount, hard_errors: hard.length, warnings: warn.length },
    };
  }
}

// validateOutline is the entry point; the *_TYPES arrays are exported as the canonical
// validated-enum vocabulary for reuse by future consumers (e.g. planning_review).
module.exports = { validateOutline, PAGE_TYPES, VISUAL_WEIGHTS, END_PAGE_TYPES, LAYOUT_TYPES };
