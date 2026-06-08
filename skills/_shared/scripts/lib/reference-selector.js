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
//   - special slides cover/end (passed by   → layout-craft
//     the agent as --type, not in pages[])
//   - body page with a hero-ish layout_type → layout-craft
//     (single_focus / hero_grid / full_bleed: one dominant element where the
//      gravity-field composition craft matters most)
//   - type comparison/process               → blocks
//   - type quote/image                      → blocks
//   - any page (low priority)               → color-psychology
// Then: dedupe, sort by rule priority (stable), cap (default 4).
//
// NOTE on the page-type vocabulary: the real pages[].type enum is
// content|data|comparison|process|quote|image (planning-validator PAGE_TYPES).
// `cover`/`end` are NOT page types — they are the outline's top-level cover /
// end_page slides, for which the agent invokes the selector with an explicit
// `--type cover` / `--type end`. `timeline` is a layout_type, not a page type
// (and process pages already route to blocks), so it is not matched on `type`.

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
    const layoutType = String(p.layout_type || '').toLowerCase();
    const dtypes = elementTypes(p.data_elements);

    // Hero-ish layout_type values (subset of the canonical 10 LAYOUT_TYPES)
    // where a single dominant element drives the composition — the gravity-field
    // craft in layout-craft.md is most relevant for these.
    const HERO_LAYOUTS = new Set(['single_focus', 'hero_grid', 'full_bleed']);

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

    // Special slides (cover / end_page) are passed by the agent as explicit
    // --type cover / --type end (they are not in pages[]); a body page earns
    // layout-craft when its layout_type is hero-ish.
    if (type === 'cover' || type === 'end') {
      add(REF.LAYOUT, 1, 'cover/end slide → layout-craft (gravity-field rendering for the 10 layout_type)');
    } else if (HERO_LAYOUTS.has(layoutType)) {
      add(REF.LAYOUT, 1, `hero-ish layout_type "${layoutType}" → layout-craft (gravity-field composition)`);
    }

    if (type === 'comparison' || type === 'process') {
      add(REF.BLOCKS, 1, 'comparison/process → blocks (matching composite component soul)');
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
