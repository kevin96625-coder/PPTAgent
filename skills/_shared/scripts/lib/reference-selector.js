'use strict';

// P4 — lightweight reference selector. Maps a page's shape to the supplemental
// reference IDs slide-core/content-core should read (on top of the always-read
// core refs svg-generator/bento-grid/style, which are NOT routed through here).
//
// Pure logic, no I/O. NEVER throws: a missing/garbage index or bad page input
// degrades to empty ids + an explanatory reason (caller falls back to core refs).
//
// Selection rules (deterministic, keyword + page-type), spec §2:
//   - data_elements has chart/metric/data  → charts-catalog + design-cheatsheet
//   - type cover/section/end               → layout-craft
//   - type comparison/process/timeline     → blocks
//   - type quote/image                     → blocks
//   - any page (low priority)              → color-psychology
// Then: dedupe, sort by rule priority (stable), cap (default 4).

// Reference IDs as registered in index.json.
const REF = {
  CHARTS: 'chart-charts-catalog',
  CHEATSHEET: 'reference-design-cheatsheet',
  LAYOUT: 'craft-layout-craft',
  BLOCKS: 'block-blocks',
  COLOR: 'principle-color-psychology',
  FAILURE: 'principle-failure-modes',
};

function asArray(x) {
  return Array.isArray(x) ? x : [];
}

function elementTypes(dataElements) {
  return asArray(dataElements)
    .map((e) => (e && typeof e === 'object' ? String(e.type || '') : String(e || '')))
    .map((s) => s.toLowerCase());
}

/**
 * @param {{type?:string, layout_type?:string, data_elements?:Array, has_asset?:boolean}} page
 * @param {{index?:object, cap?:number}} opts
 * @returns {{ids:string[], reason:string[]}}
 */
function selectReferences(page, opts) {
  const out = { ids: [], reason: [] };
  try {
    const options = opts && typeof opts === 'object' ? opts : {};
    const cap = Number.isInteger(options.cap) && options.cap > 0 ? options.cap : 4;
    const index = options.index;

    // Graceful degradation: no/garbage index → empty (agent reads core only).
    const resources = index && Array.isArray(index.resources) ? index.resources : null;
    if (!resources) {
      out.reason.push('index missing or malformed (no resources[]); fall back to core references only');
      return out;
    }
    const known = new Set(resources.map((r) => r && r.id));

    const p = page && typeof page === 'object' ? page : {};
    const type = String(p.type || '').toLowerCase();
    const dtypes = elementTypes(p.data_elements);

    // Candidate list: [id, priority, reason]. Lower priority sorts first.
    const candidates = [];
    const add = (id, prio, why) => {
      if (known.has(id)) candidates.push([id, prio, why]);
    };

    const hasData = dtypes.some((t) => t === 'chart' || t === 'metric' || t === 'data');
    if (hasData || type === 'data') {
      add(REF.CHARTS, 1, 'data page / chart|metric data_elements → chart taxonomy & SVG skeletons');
      add(REF.CHEATSHEET, 2, 'data page → field-level design cheatsheet (data honesty, hierarchy)');
    }

    if (type === 'cover' || type === 'section' || type === 'end') {
      add(REF.LAYOUT, 1, 'cover/section/end → layout-craft (gravity-field rendering for the 10 layout_type)');
    }

    if (type === 'comparison' || type === 'process' || type === 'timeline') {
      add(REF.BLOCKS, 1, 'comparison/process/timeline → blocks (matching composite component soul)');
    }
    if (type === 'quote' || type === 'image') {
      add(REF.BLOCKS, 2, 'quote/image → blocks (quote / image_hero component soul)');
    }

    // Any page may benefit from color theory; lowest priority so it only fills
    // remaining cap slots after the page-type-specific picks.
    add(REF.COLOR, 5, 'optional color-psychology (60/30/10, contrast safety)');

    // Dedupe keeping the strongest (lowest) priority + its reason.
    const best = new Map();
    for (const [id, prio, why] of candidates) {
      const cur = best.get(id);
      if (!cur || prio < cur.prio) best.set(id, { prio, why });
    }

    // Stable sort by priority, then by a fixed id order for determinism.
    const ordered = [...best.entries()].sort((a, b) => {
      if (a[1].prio !== b[1].prio) return a[1].prio - b[1].prio;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });

    for (const [id, { why }] of ordered.slice(0, cap)) {
      out.ids.push(id);
      out.reason.push(why);
    }
    if (out.ids.length === 0) {
      out.reason.push('no page-type match; core references suffice');
    }
    return out;
  } catch (err) {
    // Belt-and-suspenders: never throw.
    return { ids: [], reason: [`selector error (degraded to core only): ${err && err.message}`] };
  }
}

module.exports = { selectReferences, REF };
