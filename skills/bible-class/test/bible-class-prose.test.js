'use strict';

/**
 * Structural prose tests for commands/bible-class.md orchestration contract.
 * 
 * These tests lock down the critical invariants that prevent double-runs,
 * fake images, and broken agent contracts.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Read commands/bible-class.md from repo root
const REPO_ROOT = path.resolve(__dirname, '../../..');
const COMMAND_FILE = path.join(REPO_ROOT, 'commands/bible-class.md');

let commandText;
try {
  commandText = fs.readFileSync(COMMAND_FILE, 'utf8');
} catch (err) {
  throw new Error(`Failed to read ${COMMAND_FILE}: ${err.message}`);
}

test('commands/bible-class.md exists and is non-empty', () => {
  assert.ok(commandText.length > 1000, 'command file should be substantial');
});

test('bible-image-core is invoked via Task exactly ONCE (no double-run)', () => {
  // Match: Task(subagent_type="ppt-agent:bible-image-core", ...)
  // or:    Task(subagent_type='ppt-agent:bible-image-core', ...)
  const taskPattern = /Task\s*\(\s*subagent_type\s*=\s*["']ppt-agent:bible-image-core["']/g;
  const matches = commandText.match(taskPattern);
  
  assert.ok(matches !== null, 'bible-image-core must be invoked at least once');
  assert.strictEqual(
    matches.length,
    1,
    `bible-image-core must be invoked exactly once, found ${matches.length} invocations (double-run bug)`
  );
});

test('bible-image-core invocation does NOT pass phase= parameter', () => {
  // Find the Task invocation line(s)
  const taskRegion = /Task\s*\(\s*subagent_type\s*=\s*["']ppt-agent:bible-image-core["'][^)]+\)/gs;
  const invocations = commandText.match(taskRegion);
  
  assert.ok(invocations !== null, 'bible-image-core invocation must exist');
  
  for (const inv of invocations) {
    assert.ok(
      !inv.includes('phase='),
      `bible-image-core invocation must NOT include phase= parameter (agent does not accept it). Found: ${inv.slice(0, 200)}`
    );
  }
});

test('master generation explicitly states NO --reference flag', () => {
  // Master generation should mention "NO --reference" or "no --reference" or "without --reference"
  const masterGenRegion = commandText.toLowerCase();
  assert.ok(
    masterGenRegion.includes('no --reference') || 
    masterGenRegion.includes('without --reference') ||
    masterGenRegion.includes('(no `--reference`'),
    'master generation section must explicitly state NO --reference for master'
  );
});

test('scene generation ALWAYS includes --reference to master', () => {
  // Look for scene generation command examples with --reference flag pointing to master-reference.png
  const sceneGenPattern = /--reference\s+[^\s]*master[/-]master-reference\.png/i;
  const matches = commandText.match(sceneGenPattern);
  
  assert.ok(
    matches !== null && matches.length > 0,
    'scene generation must include --reference pointing to master/master-reference.png'
  );
});

test('master approval (Hard Stop) occurs BEFORE scene generation loop', () => {
  // Find line numbers of key markers
  const lines = commandText.split('\n');
  
  let masterApprovalLine = -1;
  let sceneLoopLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Master approval markers: "master hard stop", "hard stop", "approve master"
    // In new structure, master hard stop is mentioned in Phase 3 execution description
    if (
      (line.includes('master') && line.includes('hard stop')) ||
      (line.includes('hard stop:') && line.includes('agent uses')) ||
      (line.includes('approval') && line.includes('master') && line.includes('on approval'))
    ) {
      if (masterApprovalLine === -1) masterApprovalLine = i;
    }
    
    // Scene loop markers: "phase 4 execution", "for each scene"
    // In new structure, Phase 4 execution follows master approval in the same agent call description
    if (
      (line.includes('phase 4 execution') && line.includes('after master')) ||
      (line.includes('for each scene') && line.includes('sorted'))
    ) {
      if (sceneLoopLine === -1) sceneLoopLine = i;
    }
  }
  
  assert.ok(masterApprovalLine > 0, 'master approval section must exist');
  assert.ok(sceneLoopLine > 0, 'scene generation loop section must exist');
  assert.ok(
    masterApprovalLine < sceneLoopLine,
    `master approval (line ${masterApprovalLine}) must occur BEFORE scene generation loop (line ${sceneLoopLine})`
  );
});

test('resume logic: approved outline proceeds to Phase 3 (not "not implemented")', () => {
  // Find the resume detection section (around line 102-108 in original)
  const resumeRegion = commandText.match(/resume detection[^]*?approved.*?true[^]*?(Phase 3|phase 3)/is);
  
  assert.ok(resumeRegion !== null, 'resume detection for approved outline → Phase 3 must exist');
  
  // Must NOT say "not implemented" or "not yet implemented"
  const lowerResume = resumeRegion[0].toLowerCase();
  assert.ok(
    !lowerResume.includes('not implemented') && !lowerResume.includes('not yet implemented'),
    'resume logic must NOT say "not implemented" for approved outline → Phase 3'
  );
});

test('no fake images: contains "do NOT fake" or "status missing" placeholder semantics', () => {
  const lower = commandText.toLowerCase();
  
  const hasDontFake = lower.includes('do not fake') || lower.includes('don\'t fake') || lower.includes('not fake');
  const hasStatusMissing = lower.includes('status') && lower.includes('missing');
  const hasPlaceholder = lower.includes('placeholder');
  
  assert.ok(
    hasDontFake || (hasStatusMissing && hasPlaceholder),
    'command must include "do NOT fake" or "status: missing" placeholder semantics for failed images'
  );
});

test('Phase 3 title exists and is top-level (## not ###)', () => {
  const phase3Match = commandText.match(/^## Phase 3:/m);
  assert.ok(phase3Match !== null, 'Phase 3 must be a top-level ## heading');
});

test('Phase 4 title exists and is top-level (## not ###)', () => {
  const phase4Match = commandText.match(/^## Phase 4:/m);
  assert.ok(phase4Match !== null, 'Phase 4 must be a top-level ## heading');
});

test('Phase 5 title exists and is top-level (## not ###)', () => {
  const phase5Match = commandText.match(/^## Phase 5[:\s—-]/m);
  assert.ok(phase5Match !== null, 'Phase 5 must be a top-level ## heading (not ###)');
});

test('Phase 6 title exists and is top-level (## not ###)', () => {
  const phase6Match = commandText.match(/^## Phase 6[:\s—-]/m);
  assert.ok(phase6Match !== null, 'Phase 6 must be a top-level ## heading (not ###)');
});

test('expected agent signal is "bible-image-core-done" not invented signals', () => {
  // The agent actually sends "bible-image-core-done" (from line 305 of bible-image-core.md)
  // Commands should wait for this, not for "master-approved" or "phase-4-complete" etc
  const lower = commandText.toLowerCase();

  assert.ok(
    lower.includes('bible-image-core-done'),
    'command must reference the actual agent signal: bible-image-core-done'
  );
});

test('resume logic has a Phase-4 branch (master_reference set → resume at Phase 4, reuse master)', () => {
  // After a master is approved but scenes are incomplete, --run-id resume must land in
  // Phase 4 reusing the existing master — NOT re-run Phase 3 / regenerate the master.
  const lower = commandText.toLowerCase();
  // The branch must key on a non-null master_reference and route to Phase 4.
  const hasMasterRefKey = lower.includes('master_reference');
  const routesToPhase4 = /master_reference[^]*?(resume at phase 4|phase 4)/is.test(commandText);
  const reuseNotRegen = lower.includes('reuse') && lower.includes('master/master-reference.png');
  assert.ok(hasMasterRefKey, 'resume detection must reference master_reference');
  assert.ok(routesToPhase4, 'a non-null master_reference must route resume to Phase 4');
  assert.ok(reuseNotRegen, 'Phase-4 resume must REUSE master/master-reference.png (not regenerate)');
  // And it must be ordered BEFORE the generic "approved → Phase 3" branch (most specific first).
  const p4Idx = commandText.toLowerCase().indexOf('resume at phase 4');
  const p3Idx = commandText.toLowerCase().indexOf('skip to phase 3');
  assert.ok(p4Idx > 0 && p3Idx > 0 && p4Idx < p3Idx,
    'the master_reference → Phase 4 branch must be listed before the approved → Phase 3 branch');
});

test('bible-image-core agent has a resume guard (skip master regen when already approved)', () => {
  const AGENT_FILE = path.join(REPO_ROOT, 'agents/bible-image-core.md');
  const agentText = fs.readFileSync(AGENT_FILE, 'utf8');
  const lower = agentText.toLowerCase();
  // The agent must detect an already-approved master and skip Steps 2-6 → Phase 4.
  assert.ok(lower.includes('resume guard'), 'agent must document a resume guard');
  assert.ok(lower.includes('master_reference') && lower.includes('master-reference.png'),
    'resume guard must key on a non-null master_reference + existing master png');
  const skipsToScenes = /skip steps?\s*2[–-]6|jump straight to phase 4|go directly to phase 4|directly to.*step 7/is.test(agentText);
  assert.ok(skipsToScenes,
    'resume guard must skip master generation/Hard Stop and jump straight to Phase 4 scene generation');
});
