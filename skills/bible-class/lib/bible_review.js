'use strict';

/**
 * Theological review checklist (SUNDAY_SCHOOL_DESIGN §2.7).
 * Used in the bible_review agent prompt to enumerate what to check.
 * Each item: { id, label, description }.
 */
const CHECKLIST = [
  {
    id: 'anachronism',
    label: 'Anachronism / Modern Objects',
    description:
      'No modern objects (watches, phones, buildings, vehicles, electrical items) visible in the image. ' +
      'All props, clothing, and structures must be consistent with 1st-century Near Eastern life.',
  },
  {
    id: 'faithfulness',
    label: 'Faithfulness to Scripture',
    description:
      'The scene depicted matches the lesson-source.json scripture reference and the image_brief. ' +
      'No extra-biblical events, invented miracles, or theologically loaded additions not present in the source text.',
  },
  {
    id: 'reverence',
    label: 'Reverence and Child-Appropriateness',
    description:
      'The image is reverent, not frightening or disturbing for 3–5 year-olds. ' +
      'No horror elements, violent gore, or imagery that could distress young children. ' +
      'Biblical characters (especially Jesus) are depicted with dignity.',
  },
  {
    id: 'period-setting',
    label: 'Period Setting Accuracy',
    description:
      'Clothing (robes, tunics, sandals), architecture (stone, mud brick, palm trees), ' +
      'and landscape (desert, Sea of Galilee, Jerusalem hills) are consistent with 1st-century Near Eastern context. ' +
      'No European medieval castles, Gothic crosses, or other out-of-period settings.',
  },
];

// Recognized severity levels (uppercase, from the review block format).
const SEVERITIES = new Set(['CRITICAL', 'MAJOR', 'MINOR', 'OK']);

// Flag line pattern: [SEVERITY] scene:<label> — <issue>
// Severity is matched case-insensitively and normalized to uppercase.
// The em-dash (—) or double-hyphen (--) separates scene from issue.
const FLAG_RE = /^\[([A-Za-z]+)\]\s+scene:([\w-]+)\s*[—\-]{1,2}\s*(.+)$/;

/**
 * Parse structured review flag lines from a bible-review text block.
 *
 * Input format (one flag per line):
 *   [SEVERITY] scene:<label> — <issue description>
 *
 * Lines that do not match are silently ignored (narrative prose, blank lines, headers).
 *
 * @param {string|null|undefined} text  Raw review text from the agent.
 * @returns {Array<{severity:string, scene:string, issue:string}>}
 */
function parseReviewFlags(text) {
  if (!text || typeof text !== 'string') return [];

  const flags = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const m = FLAG_RE.exec(line);
    if (!m) continue;

    const severity = m[1].toUpperCase();
    // Accept any severity string — not just the known set — so the parser is forward-compatible.
    // But normalize to uppercase.
    flags.push({
      severity: SEVERITIES.has(severity) ? severity : severity,
      scene: m[2].trim(),
      issue: m[3].trim(),
    });
  }
  return flags;
}

module.exports = { parseReviewFlags, CHECKLIST };
