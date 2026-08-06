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

/**
 * Build an identity_block string for a single character by substituting the
 * character's profile fields into the preset's identity_block_template.
 * Used for both the main protagonist and supporting characters.
 * @param {{identity_block_template:string}} presetYaml
 * @param {object} charDesc  keys: character_name, age_appearance, ethnicity, hair_description, clothing, palette
 * @returns {string}
 */
function buildIdentityBlock(presetYaml, charDesc) {
  if (!presetYaml || typeof presetYaml.identity_block_template !== 'string') {
    throw new Error('buildIdentityBlock: presetYaml.identity_block_template is required');
  }
  // Fallbacks for empty/missing fields — keeps generation working even when the
  // model (e.g. gpt path) leaves a field blank. character_name is the only truly
  // required field (we need SOMETHING to identify the character).
  if (!charDesc || !charDesc.character_name) {
    throw new Error('buildIdentityBlock: charDesc.character_name is required');
  }
  const filled = Object.assign({}, charDesc);
  if (!filled.age_appearance) filled.age_appearance = '成年成人';
  if (!filled.ethnicity) filled.ethnicity = '1世纪犹太/近东地区';
  if (!filled.hair_description) filled.hair_description = '深色头发';
  if (!filled.clothing) filled.clothing = '亚麻及踝长袍、皮凉鞋';
  if (!filled.palette) filled.palette = '温暖棕、米白、深蓝';
  let block = presetYaml.identity_block_template;
  for (const key of REQUIRED_CHAR_KEYS) {
    block = block.replace(new RegExp(`\\{${key}\\}`, 'g'), () => filled[key]);
  }
  for (const [key, val] of Object.entries(filled)) {
    block = block.replace(new RegExp(`\\{${key}\\}`, 'g'), () => String(val));
  }
  return block.trim();
}

/**
 * Write a multi-character style lock. Produces:
 *   style.lock.json                   — lock with characters map + main identity_block (backward compat)
 *   style.lock.identity.txt           — main protagonist's identity block (backward compat)
 *   style.lock.identity.<roleKey>.txt — one per character (main + supporting)
 *   style.lock.style.txt              — style block
 *
 * The main protagonist is characters[order[0]]. Its identity_block is mirrored to
 * style.lock.identity.txt and the top-level identity_block field for backward compat.
 *
 * @param {string} runDir
 * @param {object} opts
 * @param {string} opts.preset
 * @param {object} opts.presetYaml
 * @param {object} opts.characters  map: roleKey → {character_name, role, age_appearance, ethnicity, hair_description, clothing, palette}
 * @param {string[]} opts.charactersOrder  roleKeys in order, main first
 * @returns {{jsonPath:string, idPath:string, stylePath:string, identityPaths:object}}
 */
function writeMultiCharStyleLock(runDir, { preset, presetYaml, characters, charactersOrder }) {
  if (!characters || !charactersOrder || charactersOrder.length === 0) {
    throw new Error('writeMultiCharStyleLock: characters and non-empty charactersOrder are required');
  }

  // Build identity block for each character.
  const identityByRole = {};
  for (const roleKey of charactersOrder) {
    const charDesc = characters[roleKey];
    if (!charDesc) throw new Error(`writeMultiCharStyleLock: charactersOrder lists "${roleKey}" but it is missing from characters`);
    identityByRole[roleKey] = buildIdentityBlock(presetYaml, charDesc);
  }

  const mainRole = charactersOrder[0];
  const mainIdentity = identityByRole[mainRole];

  const jsonPath = path.join(runDir, 'style.lock.json');
  const idPath = path.join(runDir, 'style.lock.identity.txt');
  const stylePath = path.join(runDir, 'style.lock.style.txt');

  // characters field: roleKey → {role, character_name, identity_block}
  const charactersField = {};
  for (const roleKey of charactersOrder) {
    charactersField[roleKey] = {
      role: characters[roleKey].role || (roleKey === mainRole ? 'main' : 'supporting'),
      character_name: characters[roleKey].character_name,
      identity_block: identityByRole[roleKey],
    };
  }

  const jsonContent = {
    style_preset: String(preset),
    identity_block: mainIdentity,           // backward compat: main protagonist
    style_block: presetYaml.style_block.trim(),
    aspect: String(presetYaml.image_aspect),
    master_reference: null,                 // main protagonist; set after master generated
    characters: charactersField,
    characters_order: charactersOrder,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2));
  fs.writeFileSync(idPath, mainIdentity + '\n');           // backward compat
  fs.writeFileSync(stylePath, presetYaml.style_block.trim() + '\n');

  // Per-character identity files: style.lock.identity.<roleKey>.txt
  const identityPaths = {};
  for (const roleKey of charactersOrder) {
    const p = path.join(runDir, `style.lock.identity.${roleKey}.txt`);
    fs.writeFileSync(p, identityByRole[roleKey] + '\n');
    identityPaths[roleKey] = p;
  }

  return { jsonPath, idPath, stylePath, identityPaths };
}

module.exports = { buildStyleLock, writeStyleLock, buildIdentityBlock, writeMultiCharStyleLock, REQUIRED_CHAR_KEYS };
