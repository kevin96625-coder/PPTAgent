'use strict';

/**
 * Assemble the full image prompt. CHARACTER + STYLE blocks come first so they
 * anchor identity/style before the scene action (reduces character drift).
 * @param {{sceneBrief:string, identityBlock?:string, styleBlock?:string}} parts
 * @returns {string}
 */
function assembleFullPrompt(parts) {
  const { sceneBrief, identityBlock, styleBlock } = parts || {};
  if (!sceneBrief || !String(sceneBrief).trim()) {
    throw new Error('assembleFullPrompt: sceneBrief is required');
  }
  const sections = [];
  if (identityBlock && identityBlock.trim()) {
    sections.push(`[CHARACTER]\n${identityBlock.trim()}`);
  }
  if (styleBlock && styleBlock.trim()) {
    sections.push(`[STYLE]\n${styleBlock.trim()}`);
  }
  sections.push(`[SCENE]\n${String(sceneBrief).trim()}`);
  return sections.join('\n\n');
}

module.exports = { assembleFullPrompt };
