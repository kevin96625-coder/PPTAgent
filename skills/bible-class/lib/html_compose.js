'use strict';
const fs = require('node:fs');
const path = require('node:path');

/**
 * Zero-pad n to 2 digits.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Escape text for safe insertion into HTML attribute values and content.
 * Covers the five XML/HTML characters that must be escaped.
 * @param {string} text
 * @returns {string}
 */
function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a complete storybook slide HTML string.
 * @param {{type:string, title:string, body:string, imageSrc?:string, subtext?:string, scripture?:string, points?:string[], preset?:string}} opts
 * @returns {string}
 */
function renderSlideHtml({ type, title, body, imageSrc, subtext, scripture, points, preset = 'designed' }) {
  const imgBlock = imageSrc
    ? `  <div class="storybook-image">\n    <img src="${esc(imageSrc)}" alt="${esc(title)}">\n  </div>\n`
    : '';
  const pointsList = Array.isArray(points) ? points.filter(Boolean) : [];
  const pointsBlock = pointsList.length
    ? `    <ul class="caption-points">\n${pointsList.map((p) => `      <li>${esc(p)}</li>`).join('\n')}\n    </ul>\n`
    : '';
  const subtextBlock = subtext
    ? `    <p class="caption-subtext">${esc(subtext)}</p>\n`
    : '';
  const scriptureAttr = scripture ? ` data-scripture="${esc(scripture)}"` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${esc(title)}</title></head>
<body data-preset="${esc(preset)}" data-slide-type="${esc(type)}"${scriptureAttr}>
${imgBlock}  <div class="storybook-caption">
    <h2 class="caption-title">${esc(title)}</h2>
${pointsBlock}    <p class="caption-body">${esc(body)}</p>
${subtextBlock}  </div>
</body>
</html>`;
}

/**
 * Compose storybook HTML slides from a lesson outline.
 *
 * Writes:
 *   <slidesDir>/slide-00.html  — cover
 *   <slidesDir>/slide-01.html  — scene 1
 *   …
 *   <slidesDir>/slide-NN.html  — scene N
 *   <slidesDir>/slide-{NN+1}.html — memory verse (if present)
 *
 * Image src uses a relative path from slidesDir: "../images/scene-{NN}.png"
 * (assumes slidesDir is one level below imagesDir's parent, i.e. both are
 * direct children of RUN_DIR).
 *
 * @param {{
 *   outline: object,
 *   imagesDir: string,
 *   slidesDir: string
 * }} opts
 * @returns {string[]} Sorted absolute paths of all written HTML files.
 */
function composeStorybookHtml({ outline, imagesDir, slidesDir }) {
  if (!outline || !outline.teaching || !Array.isArray(outline.teaching.scenes) || outline.teaching.scenes.length === 0) {
    throw new Error('composeStorybookHtml: outline.teaching.scenes must be a non-empty array');
  }
  fs.mkdirSync(slidesDir, { recursive: true });

  const written = [];

  // 0. Cover slide (no image — use master reference if present, else text-only)
  const masterSrc = path.join(imagesDir, '..', 'master', 'master-reference.png');
  const coverImgSrc = fs.existsSync(masterSrc) ? '../master/master-reference.png' : null;
  const coverPath = path.join(slidesDir, 'slide-00.html');
  fs.writeFileSync(coverPath, renderSlideHtml({
    type: 'cover',
    title: outline.title || '主日学课程',
    body: outline.scripture_ref || '',
    imageSrc: coverImgSrc,
    scripture: outline.scripture_ref || '',
  }), 'utf8');
  written.push(coverPath);

  // 1. Scene slides
  for (const scene of outline.teaching.scenes) {
    const nn = pad2(scene.index);
    const imgSrc = `../images/scene-${nn}.png`;
    const slidePath = path.join(slidesDir, `slide-${nn}.html`);
    const points = (Array.isArray(scene.key_points) && scene.key_points.length)
      ? scene.key_points
      : (scene.key_message ? [scene.key_message] : []);
    fs.writeFileSync(slidePath, renderSlideHtml({
      type: 'scene',
      title: scene.title || '',
      body: scene.narration || '',
      imageSrc: imgSrc,
      subtext: scene.interaction || '',
      scripture: outline.scripture_ref || '',
      points,
    }), 'utf8');
    written.push(slidePath);
  }

  // 2. Memory-verse slide (optional)
  if (outline.memory_verse && outline.memory_verse.text) {
    // Use max scene index (not count) so the memory-verse slide never collides
    // with a scene file even if scene indices are non-contiguous.
    const mvIndex = Math.max(...outline.teaching.scenes.map((s) => s.index)) + 1;
    const mvPath = path.join(slidesDir, `slide-${pad2(mvIndex)}.html`);
    fs.writeFileSync(mvPath, renderSlideHtml({
      type: 'memory-verse',
      title: outline.memory_verse.text,
      body: outline.memory_verse.ref || '',
    }), 'utf8');
    written.push(mvPath);
  }

  written.sort();
  return written;
}

module.exports = { composeStorybookHtml, renderSlideHtml, pad2, esc };
