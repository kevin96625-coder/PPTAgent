'use strict';
// Flatten nested parts[].pages[] (same shape the validator reads).
function collectPages(outline) {
  const o = outline || {};
  const pages = [];
  for (const part of (o.parts || [])) {
    if (!part || typeof part !== 'object') continue;
    for (const pg of (part.pages || [])) if (pg && typeof pg === 'object') pages.push(pg);
  }
  return pages;
}
// Cross-reference outline asset needs against the images manifest.
function assetPlan(outline, manifest = { images: [] }) {
  const pages = collectPages(outline);
  const byPage = new Map((manifest.images || []).map((e) => [e.page, e]));
  const asset_pages = pages
    .filter((pg) => pg && pg.asset && pg.asset.needed === true)
    .map((pg) => ({ page: pg.index, kind: pg.asset.kind, query: pg.asset.query || null }));
  const needs_real_image = asset_pages
    .filter(({ page }) => {
      const e = byPage.get(page);
      return !e || e.status === 'missing' || !e.path;
    })
    .map(({ page }) => page);
  return { asset_pages, needs_real_image };
}
module.exports = { assetPlan };
