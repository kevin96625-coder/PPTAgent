'use strict';

// ─── lesson-source.json validator ────────────────────────────────────────────

const SOURCE_STRING_FIELDS = ['title', 'scripture_ref', 'material_name', 'age_group', 'raw_text'];
const SOURCE_KIND_VALUES = ['image', 'text'];

/**
 * Validate a parsed lesson-source.json object.
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateLessonSource(obj) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('lesson-source: input must be a non-null object');
    return { ok: false, errors };
  }

  // Required string fields
  for (const field of SOURCE_STRING_FIELDS) {
    if (!(field in obj)) {
      errors.push(`lesson-source: required field "${field}" is missing`);
    } else if (typeof obj[field] !== 'string') {
      errors.push(`lesson-source: field "${field}" must be a string, got ${typeof obj[field]}`);
    } else if (!obj[field].trim()) {
      errors.push(`lesson-source: field "${field}" must not be empty`);
    }
  }

  // core_points: non-empty string array
  if (!('core_points' in obj)) {
    errors.push('lesson-source: required field "core_points" is missing');
  } else if (!Array.isArray(obj.core_points)) {
    errors.push('lesson-source: field "core_points" must be an array');
  } else if (obj.core_points.length === 0) {
    errors.push('lesson-source: field "core_points" must contain at least one item');
  }

  // source_kind: enum
  if (!('source_kind' in obj)) {
    errors.push('lesson-source: required field "source_kind" is missing');
  } else if (!SOURCE_KIND_VALUES.includes(obj.source_kind)) {
    errors.push(
      `lesson-source: field "source_kind" must be one of [${SOURCE_KIND_VALUES.join(', ')}], got "${obj.source_kind}"`
    );
  }

  return { ok: errors.length === 0, errors };
}

// ─── lesson-outline.json validator ───────────────────────────────────────────

const OUTLINE_TOP_STRING_FIELDS = ['title', 'scripture_ref'];

/**
 * Validate a parsed lesson-outline.json object.
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateLessonOutline(obj) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('lesson-outline: input must be a non-null object');
    return { ok: false, errors };
  }

  // Required top-level string fields
  for (const field of OUTLINE_TOP_STRING_FIELDS) {
    if (!(field in obj)) {
      errors.push(`lesson-outline: required field "${field}" is missing`);
    } else if (typeof obj[field] !== 'string') {
      errors.push(`lesson-outline: field "${field}" must be a string, got ${typeof obj[field]}`);
    } else if (!obj[field].trim()) {
      errors.push(`lesson-outline: field "${field}" must not be empty`);
    }
  }

  // approved: must be a boolean
  if (!('approved' in obj)) {
    errors.push('lesson-outline: required field "approved" is missing');
  } else if (typeof obj.approved !== 'boolean') {
    errors.push(`lesson-outline: field "approved" must be a boolean, got ${typeof obj.approved}`);
  }

  // teaching block
  if (!('teaching' in obj) || obj.teaching === null || typeof obj.teaching !== 'object') {
    errors.push('lesson-outline: required field "teaching" is missing or not an object');
  } else {
    const t = obj.teaching;
    if (typeof t.duration_min !== 'number') {
      errors.push('lesson-outline: teaching.duration_min must be a number');
    }
    if (!Array.isArray(t.scenes)) {
      errors.push('lesson-outline: teaching.scenes must be an array');
    } else if (t.scenes.length === 0) {
      errors.push('lesson-outline: teaching.scenes must contain at least one scene');
    } else {
      t.scenes.forEach((scene, i) => {
        const prefix = `lesson-outline: teaching.scenes[${i}]`;
        if (typeof scene !== 'object' || scene === null) {
          errors.push(`${prefix} must be an object`);
          return;
        }
        for (const sf of ['title', 'key_message', 'narration', 'interaction', 'image_brief']) {
          if (!(sf in scene)) {
            errors.push(`${prefix}.${sf} is required`);
          } else if (typeof scene[sf] !== 'string') {
            errors.push(`${prefix}.${sf} must be a string`);
          }
        }
        if (typeof scene.index !== 'number') {
          errors.push(`${prefix}.index must be a number`);
        }
        if ('key_points' in scene) {
          if (!Array.isArray(scene.key_points) || scene.key_points.some((x) => typeof x !== 'string')) {
            errors.push(`${prefix}.key_points must be an array of strings when present`);
          }
        }
      });
    }
  }

  // craft block
  if (!('craft' in obj) || obj.craft === null || typeof obj.craft !== 'object') {
    errors.push('lesson-outline: required field "craft" is missing or not an object');
  } else {
    const c = obj.craft;
    if (typeof c.duration_min !== 'number') {
      errors.push('lesson-outline: craft.duration_min must be a number');
    }
    if (typeof c.title !== 'string' || !c.title.trim()) {
      errors.push('lesson-outline: craft.title must be a non-empty string');
    }
    if (!Array.isArray(c.materials)) {
      errors.push('lesson-outline: craft.materials must be an array');
    } else if (c.materials.length === 0) {
      errors.push('lesson-outline: craft.materials must contain at least one item');
    }
    if (!Array.isArray(c.steps)) {
      errors.push('lesson-outline: craft.steps must be an array');
    } else if (c.steps.length === 0) {
      errors.push('lesson-outline: craft.steps must contain at least one step');
    }
    if (typeof c.relation_to_story !== 'string' || !c.relation_to_story.trim()) {
      errors.push('lesson-outline: craft.relation_to_story must be a non-empty string');
    }
  }

  // memory_verse block
  if (!('memory_verse' in obj) || obj.memory_verse === null || typeof obj.memory_verse !== 'object') {
    errors.push('lesson-outline: required field "memory_verse" is missing or not an object');
  } else {
    for (const vf of ['text', 'ref']) {
      if (typeof obj.memory_verse[vf] !== 'string' || !obj.memory_verse[vf].trim()) {
        errors.push(`lesson-outline: memory_verse.${vf} must be a non-empty string`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateLessonSource, validateLessonOutline };
