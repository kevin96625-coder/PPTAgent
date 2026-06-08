'use strict';
const IMAGE_STATUSES = new Set(['fetched', 'generated', 'missing']);

// kind: brand-entity|scene ; status derived from path + kind unless explicitly set.
function makeEntry({ page, kind, path = null, source_url = null, backend = null, width = null, height = null, status = null }) {
  let s = status;
  if (!s) {
    if (!path) s = 'missing';
    else s = kind === 'scene' ? 'generated' : 'fetched';
  }
  return { page, kind, path, source_url, backend, width, height, status: s };
}

function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object' || !Array.isArray(m.images)) {
    return { ok: false, errors: ['manifest.images must be an array'] };
  }
  m.images.forEach((e, i) => {
    if (typeof e.page !== 'number') errors.push(`images[${i}].page must be number`);
    if (!IMAGE_STATUSES.has(e.status)) errors.push(`images[${i}].status invalid: ${e.status}`);
    if (e.status !== 'missing' && !e.path) errors.push(`images[${i}] non-missing requires path`);
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { makeEntry, validateManifest, IMAGE_STATUSES };
