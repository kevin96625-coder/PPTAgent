'use strict';

/**
 * Build the exact argv array to pass to `node skills/image-gen/scripts/generate.js`.
 * The node binary and script path are NOT included — prepend them in the caller.
 *
 * Contract (matches Plan 1 generate.js CLI):
 *   --run-dir <RD>
 *   --label <label>
 *   --out <outPath>
 *   --prompt-file <briefFile>
 *   --identity-file <identityFile>
 *   --style-file <styleFile>
 *   [--reference <reference>]   — present for scene images; OMITTED for master
 *   [--redo]                    — present when redo=true
 *
 * @param {{
 *   runDir: string,
 *   label: string,
 *   outPath: string,
 *   briefFile: string,
 *   identityFile: string,
 *   styleFile: string,
 *   reference?: string,
 *   redo?: boolean
 * }} opts
 * @returns {string[]}
 */
function buildGenerateArgs(opts) {
  const { runDir, label, outPath, briefFile, identityFile, styleFile, reference, redo } = opts;

  if (!runDir) throw new Error('buildGenerateArgs: runDir is required');
  if (!label) throw new Error('buildGenerateArgs: label is required');
  if (!outPath) throw new Error('buildGenerateArgs: outPath is required');
  if (!briefFile) throw new Error('buildGenerateArgs: briefFile is required');
  if (!identityFile) throw new Error('buildGenerateArgs: identityFile is required');
  if (!styleFile) throw new Error('buildGenerateArgs: styleFile is required');

  const args = [
    '--run-dir', String(runDir),
    '--label', String(label),
    '--out', String(outPath),
    '--prompt-file', String(briefFile),
    '--identity-file', String(identityFile),
    '--style-file', String(styleFile),
  ];

  // Include --reference only for scene images (omit for master generation).
  if (reference) {
    args.push('--reference', String(reference));
  }

  // Include --redo only when explicitly requested.
  if (redo === true) {
    args.push('--redo');
  }

  return args;
}

module.exports = { buildGenerateArgs };
