'use strict';

// Pure decision logic for the /ppt --stop-at flag. No I/O — unit-tested.

// Ordered stop targets. Order is load-bearing: research < outline < draft < design < full.
const STAGES = ['research', 'outline', 'draft', 'design', 'full'];

// The ppt.md phase each stop target completes *after*.
const STAGE_PHASE = { research: 3, outline: 4, draft: 5, design: 6, full: 7 };

function parseStopAt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 'full';
  const v = String(raw).trim().toLowerCase();
  if (!STAGES.includes(v)) {
    throw new Error(`Invalid --stop-at "${raw}". Valid values: ${STAGES.join(', ')}`);
  }
  return v;
}

// 'none'/empty → 0 (nothing completed). research..full → 1..5. Unknown → throw.
function stageRank(stage) {
  if (stage === undefined || stage === null || String(stage).trim() === '') return 0;
  const s = String(stage).trim().toLowerCase();
  if (s === 'none') return 0;
  const i = STAGES.indexOf(s);
  if (i < 0) throw new Error(`Unknown stage "${stage}"`);
  return i + 1;
}

module.exports = { STAGES, STAGE_PHASE, parseStopAt, stageRank };
