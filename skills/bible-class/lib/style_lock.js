'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Required keys in characterDesc — used to validate input and fill template placeholders.
const REQUIRED_CHAR_KEYS = [
  'character_name',
  'age_appearance',
  'ethnicity',
  'hair_description',
  'clothing',
  'palette',
];

/**
 * Build a style lock object from a preset YAML and a character description.
 *
 * @param {{preset:string, presetYaml:object, characterDesc:object}} opts
 * @returns {{style_preset:string, identity_block:string, style_block:string, aspect:string}}
 */
function buildStyleLock({ preset, presetYaml, characterDesc }) {
  if (!presetYaml || typeof presetYaml.style_block !== 'string') {
    throw new Error('buildStyleLock: presetYaml must contain a style_block string');
  }
  if (!presetYaml.identity_block_template || typeof presetYaml.identity_block_template !== 'string') {
    throw new Error('buildStyleLock: presetYaml must contain an identity_block_template string');
  }
  if (!presetYaml.image_aspect) {
    throw new Error('buildStyleLock: presetYaml must contain image_aspect');
  }

  // Validate characterDesc has the required keys.
  const missing = REQUIRED_CHAR_KEYS.filter((k) => !characterDesc || !characterDesc[k]);
  if (missing.length > 0) {
    throw new Error(`buildStyleLock: characterDesc is missing required keys: ${missing.join(', ')}`);
  }

  // Fill placeholders in the identity_block_template.
  // Use a function replacer so `$` sequences in the description (e.g. "$&", "$1")
  // are inserted literally rather than interpreted as regex replacement patterns.
  let identity_block = presetYaml.identity_block_template;
  for (const key of REQUIRED_CHAR_KEYS) {
    identity_block = identity_block.replace(new RegExp(`\\{${key}\\}`, 'g'), () => characterDesc[key]);
  }
  // Also replace any extra keys provided.
  for (const [key, val] of Object.entries(characterDesc)) {
    identity_block = identity_block.replace(new RegExp(`\\{${key}\\}`, 'g'), () => String(val));
  }

  return {
    style_preset: String(preset),
    identity_block: identity_block.trim(),
    style_block: presetYaml.style_block.trim(),
    aspect: String(presetYaml.image_aspect),
  };
}

/**
 * Write the style lock to three files in runDir:
 *   style.lock.json         — full lock object (note: master_reference is null until master is generated)
 *   style.lock.identity.txt — raw identity_block text (consumed by generate.js --identity-file)
 *   style.lock.style.txt    — raw style_block text (consumed by generate.js --style-file)
 *
 * @param {string} runDir
 * @param {{style_preset:string, identity_block:string, style_block:string, aspect:string}} lock
 * @returns {{jsonPath:string, idPath:string, stylePath:string}}
 */
function writeStyleLock(runDir, lock) {
  const jsonPath = path.join(runDir, 'style.lock.json');
  const idPath = path.join(runDir, 'style.lock.identity.txt');
  const stylePath = path.join(runDir, 'style.lock.style.txt');

  const jsonContent = {
    style_preset: lock.style_preset,
    identity_block: lock.identity_block,
    style_block: lock.style_block,
    aspect: lock.aspect,
    master_reference: null,  // set by the agent after master image is confirmed
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2));
  fs.writeFileSync(idPath, lock.identity_block + '\n');
  fs.writeFileSync(stylePath, lock.style_block + '\n');

  return { jsonPath, idPath, stylePath };
}

module.exports = { buildStyleLock, writeStyleLock, REQUIRED_CHAR_KEYS };
