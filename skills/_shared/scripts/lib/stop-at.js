'use strict';

// Pure decision logic for the /ppt --stop-at flag. No I/O — unit-tested.

// Ordered stop targets. Order is load-bearing: research < outline < draft < design < full.
const STAGES = ['research', 'outline', 'draft', 'design', 'full'];

// The ppt.md phase each stop target completes *after*.
const STAGE_PHASE = { research: 3, outline: 4, draft: 5, design: 6, full: 7 };

// The next stop target after an early stop (drives the resume hint). 'full' has none.
const NEXT_STAGE = { research: 'outline', outline: 'draft', draft: 'design', design: 'full', full: null };

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

/**
 * Decide what to do given a stop target and how far a (possibly resumed) run has progressed.
 * @param {{stopAt?:string, completed?:string, outlineApproved?:boolean}} opts
 *   stopAt: raw flag value (undefined → 'full')
 *   completed: highest fully-completed stop stage, or 'none' for a fresh run
 *   outlineApproved: whether outline.json has "approved": true
 * @returns {{action:'run'|'already-done', target:string, stopPhase:number, nextStage:(string|null), message:string}}
 */
function resolveStopAction(opts = {}) {
  const target = parseStopAt(opts.stopAt);
  const completed = opts.completed == null ? 'none' : opts.completed;
  const ti = stageRank(target);
  const ci = stageRank(completed);
  const stopPhase = STAGE_PHASE[target];
  const nextStage = NEXT_STAGE[target];

  if (ti <= ci) {
    let message = `Stage "${target}" is already complete; its artifacts are available in the run directory.`;
    if (target === 'outline' && opts.outlineApproved) {
      message = `Outline already approved. Continue design with: /ppt-agent:ppt --run-id=<id> --stop-at=full`;
    }
    return { action: 'already-done', target, stopPhase, nextStage, message };
  }
  return {
    action: 'run',
    target,
    stopPhase,
    nextStage,
    message: `Run through stage "${target}" (Phase ${stopPhase}), then stop.`,
  };
}

module.exports = { STAGES, STAGE_PHASE, NEXT_STAGE, parseStopAt, stageRank, resolveStopAction };
