'use strict';

// Pure planner (read-only): from asset-dimension review results + the images manifest,
// decide which pages should be re-generated (--redo), which should be re-shot at the
// preview gate, and which have exhausted their redo budget. Computes a plan ONLY — it
// never invokes generate.js, never spawns processes, and NEVER throws.
//
// Rules (spec §2.3):
//   - kind=scene, assetScore<6, redo_count<cap  -> redo (round = redo_count+1; carries
//       reference_of so the redo can keep --reference master). A NEW seed is chosen by the
//       agent prose at call time — this planner does NOT pick the seed (it only flags the
//       page); reusing the original seed would regenerate the same bad image.
//   - kind=brand-entity, assetScore<6           -> reshoot (search != generation: back to
//       the preview gate for a human to swap/add an official image; never auto --redo).
//   - kind=scene, redo_count>=cap               -> exhausted (keep placeholder + needs_real_image;
//       never hand-draw a fake).
//   - assetScore>=6                             -> untouched.

const CRITICAL = 6;

function indexManifest(manifest) {
  const map = new Map();
  const m = (manifest && typeof manifest === 'object') ? manifest : {};
  const images = Array.isArray(m.images) ? m.images : [];
  for (const e of images) {
    if (e && typeof e === 'object' && typeof e.page === 'number') map.set(e.page, e);
  }
  return map;
}

/**
 * @param {Array<{page:number, assetScore:number, kind:string, reason?:string}>} reviewResults
 * @param {{images:Array}} manifest images-manifest shape (per-page status/redo_count/reference_of)
 * @param {{cap?:number}} opts
 * @returns {{redo:Array, reshoot:Array, exhausted:Array}}
 */
function planRedo(reviewResults, manifest, opts = {}) {
  const cap = (opts && typeof opts.cap === 'number' && opts.cap >= 0) ? opts.cap : 2;
  const redo = [];
  const reshoot = [];
  const exhausted = [];

  let entries;
  let byPage;
  try {
    entries = Array.isArray(reviewResults) ? reviewResults : [];
    byPage = indexManifest(manifest);
  } catch (_e) {
    return { redo, reshoot, exhausted };
  }

  for (const r of entries) {
    if (!r || typeof r !== 'object') continue;
    const page = r.page;
    if (typeof page !== 'number') continue;
    const score = r.assetScore;
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    if (score >= CRITICAL) continue; // not critical -> untouched

    const entry = byPage.get(page);
    if (!entry) continue; // no manifest entry -> cannot act, skip

    const kind = r.kind || entry.kind;
    const reason = (typeof r.reason === 'string' && r.reason) ? r.reason : 'asset score below threshold';

    if (kind === 'brand-entity') {
      reshoot.push({ page, kind: 'brand-entity', reason });
      continue;
    }

    if (kind === 'scene') {
      const redoCount = typeof entry.redo_count === 'number' ? entry.redo_count : 0;
      if (redoCount >= cap) {
        exhausted.push({ page, reason: 'redo cap reached -> keep placeholder' });
      } else {
        const out = { page, kind: 'scene', round: redoCount + 1, reason };
        if (typeof entry.reference_of === 'number') out.reference_of = entry.reference_of;
        redo.push(out);
      }
      continue;
    }
    // unknown kind -> skip (degrade gracefully)
  }

  return { redo, reshoot, exhausted };
}

module.exports = { planRedo, CRITICAL };
