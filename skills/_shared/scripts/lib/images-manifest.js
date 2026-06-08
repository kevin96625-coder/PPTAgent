'use strict';
const IMAGE_STATUSES = new Set(['fetched', 'generated', 'missing']);

// kind: brand-entity|scene ; status derived from path + kind unless explicitly set.
// P6 cross-reference fields (all optional, numeric):
//   reference_of — page number of the master image this entry was derived from (--reference).
//   seed         — the generation seed (master records it so derived pages reuse it).
//   redo_count   — number of review-driven --redo rounds applied (capped at 2; default 0).
function makeEntry({ page, kind, path = null, source_url = null, backend = null, width = null, height = null, status = null, reference_of = null, seed = null, redo_count = 0 }) {
  let s = status;
  if (!s) {
    if (!path) s = 'missing';
    else s = kind === 'scene' ? 'generated' : 'fetched';
  }
  return { page, kind, path, source_url, backend, width, height, status: s, reference_of, seed, redo_count };
}

function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object' || !Array.isArray(m.images)) {
    return { ok: false, errors: ['manifest.images must be an array'] };
  }
  m.images.forEach((e, i) => {
    if (!e || typeof e !== 'object') { errors.push(`images[${i}] must be an object`); return; }
    if (typeof e.page !== 'number') errors.push(`images[${i}].page must be number`);
    if (!IMAGE_STATUSES.has(e.status)) errors.push(`images[${i}].status invalid: ${e.status}`);
    if (e.status !== 'missing' && !e.path) errors.push(`images[${i}] non-missing requires path`);
    // P6 optional numeric cross-reference fields: absent is fine (backward compat with M2.5
    // entries); present-but-non-numeric (and non-null) is invalid.
    for (const f of ['reference_of', 'seed', 'redo_count']) {
      if (f in e && e[f] != null && typeof e[f] !== 'number') {
        errors.push(`images[${i}].${f} must be a number when present`);
      }
    }
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { makeEntry, validateManifest, IMAGE_STATUSES };
