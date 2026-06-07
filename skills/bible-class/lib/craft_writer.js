'use strict';

/**
 * Render craft.md text from a lesson-outline.json object.
 * craft.md is TEXT ONLY — it is never a slide.
 *
 * @param {{ craft: object, memory_verse: object, title?: string }} outline
 * @returns {string}
 */
function renderCraftMarkdown(outline) {
  if (!outline || typeof outline !== 'object') {
    throw new Error('renderCraftMarkdown: outline must be a non-null object');
  }
  if (!outline.craft || typeof outline.craft !== 'object') {
    throw new Error('renderCraftMarkdown: outline.craft is required');
  }
  if (!outline.memory_verse || typeof outline.memory_verse !== 'object') {
    throw new Error('renderCraftMarkdown: outline.memory_verse is required');
  }

  const { craft, memory_verse } = outline;
  const lessonTitle = outline.title ? `《${outline.title}》` : '';

  const materialsList = (craft.materials || [])
    .map((m, i) => `- ${m}`)
    .join('\n');

  const stepsList = (craft.steps || [])
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  return `# 手工活动：${craft.title || ''}

**课程：** ${lessonTitle}
**时间：** ${craft.duration_min || 15} 分钟

## 所需材料

${materialsList}

## 制作步骤

${stepsList}

## 与故事的联系

${craft.relation_to_story || ''}

---

## 本课金句

> ${memory_verse.text || ''}
>
> ——${memory_verse.ref || ''}
`.trimEnd() + '\n';
}

module.exports = { renderCraftMarkdown };
