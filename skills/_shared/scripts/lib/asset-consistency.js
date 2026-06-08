'use strict';

// Pure planner (read-only): from outline.json, identify shared-subject groups so that
// cross-page images of the same subject/character can be kept visually consistent via
// generate.js --reference. Computes a plan ONLY — it never invokes generate.js, never
// spawns processes, and NEVER throws (degrades gracefully on missing/garbage fields).
//
// Grouping key = asset.subject ?? normalize(asset.query). Same key with >=2 pages forms a
// group whose master_page is the smallest page number (earliest in the deck — narratively
// establishes the look first); the rest become derived_pages. kind is carried from the
// group's pages ('scene' = AI-generated; 'brand-entity' = web-fetched real image whose
// derived pages reuse the master's downloaded file). Single-key pages are singletons.

function normalizeQuery(q) {
  if (q == null) return '';
  // strip everything that is not a letter/number (across scripts), lowercase.
  return String(q).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function collectAssetPages(outline) {
  const out = [];
  const o = (outline && typeof outline === 'object') ? outline : {};
  const parts = Array.isArray(o.parts) ? o.parts : [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const pages = Array.isArray(part.pages) ? part.pages : [];
    for (const pg of pages) {
      if (!pg || typeof pg !== 'object') continue;
      const a = pg.asset;
      if (!a || typeof a !== 'object') continue;
      if (a.needed !== true) continue;
      const kind = a.kind;
      if (kind !== 'scene' && kind !== 'brand-entity') continue;
      const page = pg.index;
      if (typeof page !== 'number' || !Number.isFinite(page)) continue;
      const subject = (typeof a.subject === 'string' && a.subject.trim())
        ? a.subject.trim()
        : null;
      const key = subject || normalizeQuery(a.query);
      if (!key) continue;
      out.push({ page, kind, subject, key });
    }
  }
  return out;
}

/**
 * @param {object} outline parsed outline.json
 * @returns {{groups:Array<{subject:string|null, master_page:number, derived_pages:number[], kind:string}>, singletons:Array<{page:number, kind:string}>}}
 */
function planReferences(outline) {
  const groups = [];
  const singletons = [];
  let assetPages;
  try {
    assetPages = collectAssetPages(outline);
  } catch (_e) {
    return { groups, singletons };
  }

  const byKey = new Map();
  for (const ap of assetPages) {
    if (!byKey.has(ap.key)) byKey.set(ap.key, []);
    byKey.get(ap.key).push(ap);
  }

  for (const list of byKey.values()) {
    const pagesSorted = list.slice().sort((a, b) => a.page - b.page);
    if (pagesSorted.length >= 2) {
      const master = pagesSorted[0];
      groups.push({
        subject: master.subject,
        master_page: master.page,
        derived_pages: pagesSorted.slice(1).map((p) => p.page),
        kind: master.kind,
      });
    } else {
      const only = pagesSorted[0];
      singletons.push({ page: only.page, kind: only.kind });
    }
  }

  groups.sort((a, b) => a.master_page - b.master_page);
  singletons.sort((a, b) => a.page - b.page);
  return { groups, singletons };
}

module.exports = { planReferences, normalizeQuery };
