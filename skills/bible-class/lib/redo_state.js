'use strict';

/**
 * Default per-label redo limit (matches SUNDAY_SCHOOL_DESIGN §2.10).
 * Users may override via the orchestrator's --redo-limit flag, but this is the guard.
 */
const REDO_LIMIT = 3;

/**
 * Pure helper: given the current approvals map and a label that the user wants to redo,
 * return the new state for that label. Does NOT mutate approvals.
 *
 * @param {Object.<string, {approved:boolean, redoCount:number}>} approvals
 *   The current per-label approval/redo state.
 * @param {string} label  The scene label to redo (e.g. "scene-03").
 * @returns {{approved:boolean, redoCount:number, limitReached:boolean}}
 * @throws if the label is already approved, or if the redo count is already at the limit.
 */
function nextRedo(approvals, label) {
  const current = approvals[label] || { approved: false, redoCount: 0 };

  if (current.approved) {
    throw new Error(`nextRedo: label "${label}" is already approved — cannot redo`);
  }
  if (current.redoCount >= REDO_LIMIT) {
    throw new Error(`nextRedo: label "${label}" has reached the redo limit (${REDO_LIMIT})`);
  }

  const newRedoCount = current.redoCount + 1;
  return {
    approved: false,
    redoCount: newRedoCount,
    limitReached: newRedoCount >= REDO_LIMIT,
  };
}

module.exports = { nextRedo, REDO_LIMIT };
