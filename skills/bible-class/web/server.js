#!/usr/bin/env node
'use strict';
const http = require('node:http');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const url = require('node:url');

const PAGES_DIR = path.join(__dirname, 'pages');
const RUNS_ROOT = path.resolve(__dirname, '..', '..', '..', 'openspec', 'changes');
const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') || '3333', 10);

const { Buffer } = require('node:buffer');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function mimeFor(ext) { return MIME[ext] || 'application/octet-stream'; }

function send(res, code, body, ext) {
  // no-cache: the UI evolves during sessions (bug fixes to inline JS); a
  // heuristically cached stale page keeps running old code after fixes land.
  res.writeHead(code, { 'Content-Type': mimeFor(ext || '.html'), 'Cache-Control': 'no-cache' });
  res.end(body);
}

function sendJSON(res, code, obj) { send(res, code, JSON.stringify(obj), '.json'); }

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) { send(res, 404, 'Not found'); return; }
  const ext = path.extname(filePath);
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': mimeFor(ext),
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

function readPage(name) {
  return fs.readFileSync(path.join(PAGES_DIR, name), 'utf8');
}

function safeId(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value)) return null;
  if (value.includes('..')) return null;
  return value;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function localFolderError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function expandHome(rawPath) {
  if (rawPath === '~') return os.homedir();
  if (rawPath.startsWith(`~${path.sep}`)) return path.join(os.homedir(), rawPath.slice(2));
  return rawPath;
}

function collectLocalImageFiles(rawFolderPath) {
  if (typeof rawFolderPath !== 'string' || !rawFolderPath.trim()) {
    throw localFolderError('Local image folder path is required.');
  }

  const folderPath = path.resolve(expandHome(rawFolderPath.trim()));
  let stat;
  try {
    stat = fs.statSync(folderPath);
  } catch {
    throw localFolderError('Local image folder not found.');
  }
  if (!stat.isDirectory()) {
    throw localFolderError('Local image folder path must be a directory.');
  }

  const images = [];
  function walk(dir, relDir = '') {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      throw localFolderError('Local image folder cannot be read.');
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        images.push({
          fullPath,
          relPath: relPath.split(path.sep).join('/'),
        });
      }
    }
  }

  walk(folderPath);
  if (!images.length) {
    throw localFolderError('Local image folder has no .png/.jpg images.');
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  images.sort((a, b) => (
    collator.compare(path.basename(a.relPath), path.basename(b.relPath))
    || collator.compare(a.relPath, b.relPath)
  ));
  return images;
}

function copyLocalImagesToInputDir(images, imgDir) {
  fs.rmSync(imgDir, { recursive: true, force: true });
  fs.mkdirSync(imgDir, { recursive: true });
  const width = Math.max(2, String(images.length).length);
  return images.map((image, i) => {
    const ext = path.extname(image.fullPath).toLowerCase();
    const file = `page-${String(i + 1).padStart(width, '0')}${ext}`;
    fs.copyFileSync(image.fullPath, path.join(imgDir, file));
    return { file, sourceName: image.relPath };
  });
}

function getRunDir(runId) {
  const safe = safeId(runId);
  if (!safe) return null;
  const dir = path.join(RUNS_ROOT, safe);
  return fs.existsSync(dir) ? dir : null;
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function writeJSON(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
}

const PHASE_ORDER = [
  'content-research', 'outline-draft', 'outline-approved',
  'style-locked', 'master-generated', 'master-approved',
  'scenes-generated', 'html-composed', 'pptx-delivered',
];
const PHASE_LABELS = {
  'content-research': '内容研究',
  'outline-draft': '大纲草稿',
  'outline-approved': '大纲已批',
  'style-locked': '风格锁定',
  'master-generated': '定妆照已生成',
  'master-approved': '定妆照已批',
  'scenes-generated': '场景图已生成',
  'html-composed': 'HTML已合成',
  'pptx-delivered': 'PPTX已交付',
};

function detectPhases(runDir) {
  const has = (f) => fs.existsSync(path.join(runDir, f));
  const lock = readJSON(path.join(runDir, 'style.lock.json'));
  const manifest = readJSON(path.join(runDir, 'image-manifest.json'));
  const outline = readJSON(path.join(runDir, 'lesson-outline.json'));
  const phases = [];
  if (has('lesson-source.json')) phases.push('content-research');
  if (outline) {
    phases.push(outline.approved ? 'outline-approved' : 'outline-draft');
  }
  if (lock) phases.push('style-locked');
  if (lock && lock.master_reference) {
    phases.push('master-approved');
  } else if (has('master/master-reference.png')) {
    phases.push('master-generated');
  }
  if (manifest && manifest.entries) {
    const sceneKeys = Object.keys(manifest.entries).filter((k) => k.startsWith('scene-'));
    if (sceneKeys.length > 0) phases.push('scenes-generated');
  }
  const slidesDir = path.join(runDir, 'slides');
  if (has('slides') && fs.readdirSync(slidesDir).some((f) => f.endsWith('.html'))) {
    phases.push('html-composed');
  }
  if (has('output/presentation.pptx')) phases.push('pptx-delivered');
  return phases;
}

function listRuns() {
  if (!fs.existsSync(RUNS_ROOT)) return [];
  return fs.readdirSync(RUNS_ROOT)
    .filter((d) => fs.statSync(path.join(RUNS_ROOT, d)).isDirectory())
    .map((id) => {
      const dir = path.join(RUNS_ROOT, id);
      const outline = readJSON(path.join(dir, 'lesson-outline.json'));
      const phases = detectPhases(dir);
      return {
        id,
        title: (outline && outline.title) || id,
        scripture: (outline && outline.scripture_ref) || '',
        sceneCount: (outline && outline.teaching && outline.teaching.scenes) ? outline.teaching.scenes.length : 0,
        phases,
        updatedAt: fs.statSync(dir).mtime.toISOString(),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getRunDetail(runId) {
  const safe = safeId(runId);
  if (!safe) return null;
  const dir = getRunDir(safe);
  if (!dir) return null;
  const outline = readJSON(path.join(dir, 'lesson-outline.json'));
  const manifest = readJSON(path.join(dir, 'image-manifest.json')) || { entries: {} };
  const lock = readJSON(path.join(dir, 'style.lock.json'));
  const scenes = (outline && outline.teaching && outline.teaching.scenes) || [];
  const slides = (() => {
    try { return fs.readdirSync(path.join(dir, 'slides')).filter((f) => f.endsWith('.html')).sort(); } catch { return []; }
  })();
  const hasPptx = fs.existsSync(path.join(dir, 'output', 'presentation.pptx'));
  const masterPath = path.join(dir, 'master', 'master-reference.png');
  const hasMaster = fs.existsSync(masterPath);
  const sceneImages = scenes.map((s) => {
    const nn = String(s.index).padStart(2, '0');
    const imgPath = path.join(dir, 'images', `scene-${nn}.png`);
    const exists = fs.existsSync(imgPath);
    const key = `scene-${nn}`;
    const entry = manifest.entries[key] || {};
    return {
      index: s.index, nn,
      title: s.title,
      key_message: s.key_message,
      key_points: s.key_points || [],
      narration: s.narration,
      interaction: s.interaction,
      image_brief: s.image_brief,
      imageExists: exists,
      approved: !!(entry.approved),
      redoCount: entry.redoCount || 0,
      needsRedo: !!(entry.needsRedo),
      timestamp: entry.timestamp || null,
    };
  });
  const phases = detectPhases(dir);
  const runMeta = readJSON(path.join(dir, 'run-meta.json')) || {};
  const source = readJSON(path.join(dir, 'lesson-source.json'));
  const inputImages = (() => {
    try {
      return fs.readdirSync(path.join(dir, 'input-images'))
        .filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
    } catch { return []; }
  })();
  return {
    id: safe,
    model: runMeta.model || null,
    imageModel: runMeta.imageModel || null,
    source,
    inputImages,
    title: (outline && outline.title) || safe,
    scripture: (outline && outline.scripture_ref) || '',
    memoryVerse: outline && outline.memory_verse,
    craft: outline && outline.craft,
    scenes, sceneImages,
    hasMaster,
    masterApproved: !!(lock && lock.master_reference),
    slides, slideCount: slides.length, hasPptx,
    lock, manifest,
    phases,
    phaseOrder: PHASE_ORDER,
    phaseLabels: PHASE_LABELS,
    updatedAt: fs.statSync(dir).mtime.toISOString(),
  };
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let settled = false;
    function finish(fn, value) {
      if (settled) return;
      settled = true;
      fn(value);
    }
    req.on('data', (c) => {
      if (settled) return;
      bytes += c.length;
      if (bytes > MAX_BODY_BYTES) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        finish(reject, err);
        req.destroy();
        return;
      }
      body += c;
    });
    req.on('end', () => {
      try { finish(resolve, JSON.parse(body)); } catch { finish(resolve, {}); }
    });
    req.on('aborted', () => {
      const err = new Error('Request aborted');
      err.statusCode = 400;
      finish(reject, err);
    });
    req.on('error', (err) => finish(reject, err));
  });
}

// ---- Router ----
const routes = [];
function addRoute(method, pattern, handler) {
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ method, parts, handler });
}
function matchRoute(method, pathname) {
  const pathParts = pathname.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.parts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.parts.length; i++) {
      if (route.parts[i].startsWith(':')) {
        params[route.parts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (route.parts[i] !== pathParts[i]) {
        ok = false; break;
      }
    }
    if (ok) return { handler: route.handler, params };
  }
  return null;
}

// ---- Pages ----
addRoute('GET', '', (req, res) => send(res, 200, readPage('dashboard.html')));
addRoute('GET', 'new', (req, res) => send(res, 200, readPage('new-run.html')));
addRoute('GET', 'run/:id', (req, res) => send(res, 200, readPage('run-detail.html')));
addRoute('GET', 'run/:id/preview', (req, res) => send(res, 200, readPage('preview.html')));
addRoute('GET', 'app.css', (req, res) => send(res, 200, readPage('app.css'), '.css'));

// ---- API: native macOS folder picker ----
addRoute('POST', 'api/pick-folder', (req, res) => {
  execFile('osascript', [
    '-e', 'tell application "System Events" to activate',
    '-e', 'POSIX path of (choose folder with prompt "选择教案图片文件夹")',
  ], { timeout: 180000 }, (err, stdout) => {
    if (err) { sendJSON(res, 200, { ok: false, cancelled: true }); return; }
    const folderPath = stdout.trim();
    let images;
    try {
      images = collectLocalImageFiles(folderPath);
    } catch (e) {
      sendJSON(res, 200, { ok: false, error: e.message, path: folderPath });
      return;
    }
    sendJSON(res, 200, {
      ok: true,
      path: folderPath,
      imageCount: images.length,
      images: images.map((i) => i.relPath),
    });
  });
});

// ---- API: create run + upload images ----
addRoute('POST', 'api/runs', async (req, res) => {
  let body;
  try { body = await parseBody(req); } catch (err) {
    sendJSON(res, err.statusCode || 400, { error: err.message }); return;
  }
  const id = body.id || ('bc-' + Date.now());
  const safe = safeId(id);
  if (!safe) { sendJSON(res, 400, { error: 'Invalid run id' }); return; }

  let localImages = null;
  if (body.imageFolderPath) {
    try {
      localImages = collectLocalImageFiles(body.imageFolderPath);
    } catch (err) {
      sendJSON(res, err.statusCode || 500, { error: err.message });
      return;
    }
  }

  const dir = path.join(RUNS_ROOT, safe);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const imgDir = path.join(dir, 'input-images');
  let importedImages = [];
  try {
    if (localImages) {
      importedImages = copyLocalImagesToInputDir(localImages, imgDir);
    } else if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }
  } catch (err) {
    sendJSON(res, 500, { error: `Failed to import local images: ${err.message}` });
    return;
  }

  if (body.inputText) {
    fs.writeFileSync(path.join(dir, 'input.md'), body.inputText);
  }

  const source = {
    title: body.title || id,
    scripture_ref: body.scripture || '',
    material_name: body.materialName || '',
    age_group: body.ageGroup || '3-5',
    core_points: body.corePoints || [],
    raw_text: body.inputText || '',
    source_kind: localImages ? 'local-image-folder' : 'image',
  };
  if (importedImages.length) {
    source.source_images = importedImages.map(({ file, sourceName }) => ({ file, sourceName }));
  }
  writeJSON(path.join(dir, 'lesson-source.json'), source);

  if (body.model || body.imageModel) {
    writeJSON(path.join(dir, 'run-meta.json'), { model: body.model, imageModel: body.imageModel });
  }

  sendJSON(res, 200, {
    ok: true,
    id: safe,
    imageCount: importedImages.length,
    images: importedImages.map((image) => image.file),
  });
});

addRoute('GET', 'api/runs/:id/input-images', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const imgDir = path.join(dir, 'input-images');
  if (!fs.existsSync(imgDir)) { sendJSON(res, 200, { images: [] }); return; }
  const images = fs.readdirSync(imgDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();
  sendJSON(res, 200, { images });
});

addRoute('GET', 'api/runs/:id/input-images/:name', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const safeName = safeId(params.name);
  if (!safeName) { send(res, 404, 'Not found'); return; }
  sendFile(res, path.join(dir, 'input-images', safeName));
});

// ---- API: upload single image (streaming, no buffering) ----
addRoute('PUT', 'api/runs/:id/input-images/:name', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const safeName = safeId(params.name);
  if (!safeName || !/\.(png|jpe?g)$/i.test(safeName)) {
    sendJSON(res, 400, { error: 'Only .png/.jpg files allowed' }); return;
  }
  const imgDir = path.join(dir, 'input-images');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  const dest = path.join(imgDir, safeName);
  const ws = fs.createWriteStream(dest);
  req.pipe(ws);
  ws.on('finish', () => sendJSON(res, 200, { ok: true, file: safeName }));
  ws.on('error', (err) => sendJSON(res, 500, { error: err.message }));
});

// ---- API: runs ----
addRoute('GET', 'api/runs', (req, res) => sendJSON(res, 200, { runs: listRuns() }));

addRoute('GET', 'api/runs/:id', (req, res, params) => {
  const detail = getRunDetail(params.id);
  if (!detail) { sendJSON(res, 404, { error: 'Run not found' }); return; }
  sendJSON(res, 200, detail);
});

// ---- API: static files ----
addRoute('GET', 'api/runs/:id/images/:name', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const safeName = safeId(params.name);
  if (!safeName) { send(res, 404, 'Not found'); return; }
  sendFile(res, path.join(dir, 'images', safeName));
});
addRoute('GET', 'api/runs/:id/master/:name', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const safeName = safeId(params.name);
  if (!safeName) { send(res, 404, 'Not found'); return; }
  sendFile(res, path.join(dir, 'master', safeName));
});
addRoute('GET', 'api/runs/:id/slides/:name', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const safeName = safeId(params.name);
  if (!safeName) { send(res, 404, 'Not found'); return; }
  sendFile(res, path.join(dir, 'slides', safeName));
});

// ---- API: pptx download ----
addRoute('GET', 'api/runs/:id/pptx', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const pptx = path.join(dir, 'output', 'presentation.pptx');
  if (!fs.existsSync(pptx)) { send(res, 404, 'PPTX not found'); return; }
  const stat = fs.statSync(pptx);
  res.writeHead(200, {
    'Content-Type': mimeFor('.pptx'),
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${safeId(params.id)}.pptx"`,
  });
  fs.createReadStream(pptx).pipe(res);
});

// ---- API: outline ----
addRoute('GET', 'api/runs/:id/outline', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const outline = readJSON(path.join(dir, 'lesson-outline.json'));
  if (!outline) { sendJSON(res, 404, { error: 'No outline' }); return; }
  sendJSON(res, 200, outline);
});

// ---- API: export outline as standalone styled HTML ----
function escHtml(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

addRoute('GET', 'api/runs/:id/outline.html', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const o = readJSON(path.join(dir, 'lesson-outline.json'));
  if (!o) { send(res, 404, 'No outline'); return; }
  const scenes = (o.teaching && o.teaching.scenes) || [];
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${escHtml(o.title)} — 教学大纲</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'PingFang SC','Hiragino Sans GB',sans-serif; background:#FBF7EF; color:#2B2B2B; padding:3rem 1.5rem; }
  .wrap { max-width:820px; margin:0 auto; }
  h1 { color:#163A5F; font-size:1.8rem; margin-bottom:.4rem; }
  .meta { color:#8a7f6e; font-size:.95rem; margin-bottom:2rem; }
  .verse { background:#fff; border-left:5px solid #F4A259; border-radius:8px; padding:1rem 1.25rem; margin-bottom:2rem; }
  .verse .t { font-weight:700; color:#163A5F; margin-bottom:.25rem; }
  .verse .r { color:#F4A259; font-size:.85rem; }
  h2 { color:#163A5F; font-size:1.15rem; margin:2rem 0 1rem; border-bottom:2px solid #F4A259; padding-bottom:.4rem; }
  .scene { background:#fff; border:1px solid #eadfcc; border-radius:10px; padding:1.1rem 1.3rem; margin-bottom:.9rem; }
  .scene h3 { color:#163A5F; font-size:1.02rem; margin-bottom:.5rem; }
  .scene p { font-size:.92rem; line-height:1.65; margin:.25rem 0; }
  .scene b { color:#163A5F; }
  .scene .brief { color:#8a7f6e; font-size:.85rem; }
  ol { padding-left:1.4rem; } ol li { font-size:.92rem; line-height:1.7; }
  .mats { color:#8a7f6e; font-size:.9rem; margin-bottom:.5rem; }
  @media print { body { background:#fff; padding:0; } .scene { break-inside:avoid; } }
</style></head>
<body><div class="wrap">
  <h1>${escHtml(o.title)}</h1>
  <div class="meta">经文：${escHtml(o.scripture_ref)} · ${scenes.length} 个教学场景 · 教学 ${o.teaching && o.teaching.duration_min || 15} 分钟 + 手工 ${o.craft && o.craft.duration_min || 15} 分钟</div>
  ${o.memory_verse ? `<div class="verse"><div class="t">${escHtml(o.memory_verse.text)}</div><div class="r">${escHtml(o.memory_verse.ref || '')}</div></div>` : ''}
  <h2>教学场景（每幕一页 PPT）</h2>
  ${scenes.map((s) => `<div class="scene">
    <h3>第 ${s.index} 幕 · ${escHtml(s.title)}</h3>
    <p><b>要点：</b>${escHtml(s.key_message)}</p>
    <p><b>旁白：</b>${escHtml(s.narration)}</p>
    <p><b>互动：</b>${escHtml(s.interaction)}</p>
    <p class="brief"><b>配图：</b>${escHtml(s.image_brief)}</p>
  </div>`).join('')}
  ${o.craft ? `<h2>手工活动 — ${escHtml(o.craft.title)}</h2>
  <div class="scene">
    <p class="mats"><b>材料：</b>${escHtml((o.craft.materials || []).join('、'))}</p>
    <ol>${(o.craft.steps || []).map((st) => `<li>${escHtml(st)}</li>`).join('')}</ol>
    ${o.craft.relation_to_story ? `<p style="margin-top:.6rem"><b>与故事的联系：</b>${escHtml(o.craft.relation_to_story)}</p>` : ''}
  </div>` : ''}
</div></body></html>`;
  const wantDownload = (req.url || '').includes('download=1');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    ...(wantDownload ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(o.title || params.id)}-outline.html"` } : {}),
  });
  res.end(html);
});

// ---- API: approve outline ----
addRoute('POST', 'api/runs/:id/approve/outline', async (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const filePath = path.join(dir, 'lesson-outline.json');
  const outline = readJSON(filePath);
  if (!outline) { sendJSON(res, 404, { error: 'No outline' }); return; }
  outline.approved = true;
  writeJSON(filePath, outline);
  sendJSON(res, 200, { ok: true, approved: true });
});

// ---- API: approve master ----
addRoute('POST', 'api/runs/:id/approve/master', async (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const filePath = path.join(dir, 'style.lock.json');
  let lock = readJSON(filePath);
  if (!lock) { sendJSON(res, 400, { error: 'No style.lock.json' }); return; }
  if (!fs.existsSync(path.join(dir, 'master', 'master-reference.png'))) {
    sendJSON(res, 400, { error: 'Master image not generated yet' }); return;
  }
  lock.master_reference = 'master/master-reference.png';
  writeJSON(filePath, lock);
  sendJSON(res, 200, { ok: true, masterApproved: true });
});

// ---- API: approve scene ----
addRoute('POST', 'api/runs/:id/approve/scene/:nn', async (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const filePath = path.join(dir, 'image-manifest.json');
  let manifest = readJSON(filePath) || { entries: {} };
  const key = `scene-${params.nn}`;
  if (!manifest.entries[key]) manifest.entries[key] = {};
  manifest.entries[key].approved = true;
  manifest.entries[key].needsRedo = false;
  writeJSON(filePath, manifest);
  sendJSON(res, 200, { ok: true, scene: key, approved: true });
});

// ---- API: reject scene (mark for redo) ----
addRoute('POST', 'api/runs/:id/reject/scene/:nn', async (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const body = await parseBody(req);
  const filePath = path.join(dir, 'image-manifest.json');
  let manifest = readJSON(filePath) || { entries: {} };
  const key = `scene-${params.nn}`;
  if (!manifest.entries[key]) manifest.entries[key] = {};
  manifest.entries[key].approved = false;
  manifest.entries[key].needsRedo = true;
  manifest.entries[key].redoCount = (manifest.entries[key].redoCount || 0) + 1;
  if (body.reason) manifest.entries[key].redoReason = body.reason;
  writeJSON(filePath, manifest);
  sendJSON(res, 200, { ok: true, scene: key, needsRedo: true, redoCount: manifest.entries[key].redoCount });
});

// ---- API: style.lock ----
addRoute('GET', 'api/runs/:id/style-lock', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const lock = readJSON(path.join(dir, 'style.lock.json'));
  if (!lock) { sendJSON(res, 404, { error: 'No style.lock.json' }); return; }
  sendJSON(res, 200, lock);
});

// ---- API: scene detail ----
addRoute('GET', 'api/runs/:id/scene/:nn', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const outline = readJSON(path.join(dir, 'lesson-outline.json'));
  if (!outline || !outline.teaching) { sendJSON(res, 404, { error: 'No outline' }); return; }
  const idx = parseInt(params.nn, 10);
  const scene = outline.teaching.scenes.find((s) => s.index === idx);
  if (!scene) { sendJSON(res, 404, { error: 'Scene not found' }); return; }
  const manifest = readJSON(path.join(dir, 'image-manifest.json')) || { entries: {} };
  const key = `scene-${params.nn}`;
  const entry = manifest.entries[key] || {};
  const imgPath = path.join(dir, 'images', `scene-${params.nn}.png`);
  sendJSON(res, 200, {
    ...scene, nn: params.nn,
    imageExists: fs.existsSync(imgPath),
    approved: !!entry.approved,
    needsRedo: !!entry.needsRedo,
    redoCount: entry.redoCount || 0,
    timestamp: entry.timestamp || null,
  });
});

// ---- Execution Engine ----
const { phases: PHASES, PHASE_ORDER: EXEC_PHASE_ORDER, killRun } = require('./phases');
const activeExecutions = new Map(); // execution key → Set<ServerResponse>
const executionHistory = new Map(); // execution key → [{ event, data }]
const runLocks = new Map(); // runId → { phase, startedAt }
const MAX_EXECUTION_HISTORY = 200;

function writeSSE(res, event, data) {
  if (res.destroyed || res.writableEnded) return false;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return true;
}

function addExecutionStream(key, res) {
  let streams = activeExecutions.get(key);
  if (!streams) {
    streams = new Set();
    activeExecutions.set(key, streams);
  }
  streams.add(res);
}

function removeExecutionStream(key, res) {
  const streams = activeExecutions.get(key);
  if (!streams) return;
  streams.delete(res);
  if (streams.size === 0) activeExecutions.delete(key);
}

function resetExecutionHistory(key) {
  executionHistory.set(key, []);
}

function emitExecutionEvent(key, event, data) {
  const history = executionHistory.get(key) || [];
  history.push({ event, data });
  if (history.length > MAX_EXECUTION_HISTORY) history.splice(0, history.length - MAX_EXECUTION_HISTORY);
  executionHistory.set(key, history);

  const streams = activeExecutions.get(key);
  if (!streams) return;
  for (const stream of streams) {
    if (!writeSSE(stream, event, data)) streams.delete(stream);
  }
  if (streams.size === 0) activeExecutions.delete(key);
}

function replayExecutionHistory(key, res) {
  for (const item of executionHistory.get(key) || []) {
    if (!writeSSE(res, item.event, item.data)) return;
  }
}

// Persist per-phase execution state to the run dir so progress survives
// server restarts (断点续做). status: running | done | error.
// A persisted "running" with no live lock means the phase was interrupted.
function updateExecState(runId, phase, patch) {
  const file = path.join(RUNS_ROOT, runId, 'execution-state.json');
  const state = readJSON(file) || {};
  state[phase] = { ...(state[phase] || {}), ...patch };
  writeJSON(file, state);
}

function readExecState(dir) {
  return readJSON(path.join(dir, 'execution-state.json')) || {};
}

function acquireRunLock(runId, phase) {
  if (runLocks.has(runId)) {
    const lock = runLocks.get(runId);
    return { ok: false, lock };
  }
  runLocks.set(runId, { phase, startedAt: Date.now() });
  return { ok: true };
}

function assertRunDirWithinRoot(runId, dir) {
  const expected = path.resolve(RUNS_ROOT, runId);
  const resolvedDir = path.resolve(dir);
  if (resolvedDir !== expected) {
    throw new Error('Refusing to delete path outside run root');
  }
}

function clearExecutionStateForRun(runId) {
  const prefix = `${runId}:`;
  for (const [key, streams] of activeExecutions.entries()) {
    if (!key.startsWith(prefix)) continue;
    for (const stream of streams) {
      writeSSE(stream, 'status', { status: 'deleted', phase: key.slice(prefix.length) });
      if (!stream.destroyed && !stream.writableEnded) stream.end();
    }
    activeExecutions.delete(key);
  }
  for (const key of executionHistory.keys()) {
    if (key.startsWith(prefix)) executionHistory.delete(key);
  }
}

// Delete an entire run directory and all generated artifacts.
addRoute('DELETE', 'api/runs/:id', (req, res, params) => {
  const runId = safeId(params.id);
  if (!runId) { sendJSON(res, 404, { error: 'Run not found' }); return; }
  const dir = getRunDir(runId);
  if (!dir) { sendJSON(res, 404, { error: 'Run not found' }); return; }
  if (runLocks.has(runId)) {
    const lock = runLocks.get(runId);
    sendJSON(res, 409, { error: `Phase "${lock.phase}" already running (${Math.round((Date.now() - lock.startedAt) / 1000)}s ago)` });
    return;
  }
  try {
    assertRunDirWithinRoot(runId, dir);
    fs.rmSync(dir, { recursive: true, force: false });
    clearExecutionStateForRun(runId);
    sendJSON(res, 200, { ok: true, id: runId });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
});

// Page
addRoute('GET', 'run/:id/execute', (req, res) => send(res, 200, readPage('execute.html')));

// SSE stream
addRoute('GET', 'api/runs/:id/execute/:phase/stream', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { send(res, 404, 'Not found'); return; }
  const runId = safeId(params.id);
  if (!runId || !PHASES[params.phase]) { send(res, 404, 'Not found'); return; }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: {}\n\n`);

  const key = `${runId}:${params.phase}`;
  addExecutionStream(key, res);
  replayExecutionHistory(key, res);
  req.on('close', () => { removeExecutionStream(key, res); });
});

// Trigger phase execution
addRoute('POST', 'api/runs/:id/execute/:phase', async (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const runId = safeId(params.id);
  if (!runId) { sendJSON(res, 404, { error: 'Not found' }); return; }

  const phaseDef = PHASES[params.phase];
  if (!phaseDef) { sendJSON(res, 400, { error: `Unknown phase: ${params.phase}` }); return; }

  const lockResult = acquireRunLock(runId, params.phase);
  if (!lockResult.ok) {
    const lk = lockResult.lock;
    sendJSON(res, 409, { error: `Phase "${lk.phase}" already running (${Math.round((Date.now() - lk.startedAt) / 1000)}s ago)` });
    return;
  }

  let body;
  try { body = await parseBody(req); } catch (err) {
    runLocks.delete(runId);
    sendJSON(res, err.statusCode || 400, { error: err.message }); return;
  }
  const key = `${runId}:${params.phase}`;
  resetExecutionHistory(key);

  sendJSON(res, 200, { ok: true, phase: params.phase, status: 'started' });

  try {
    emitExecutionEvent(key, 'status', { status: 'running', phase: params.phase });
    updateExecState(runId, params.phase, { status: 'running', startedAt: Date.now(), endedAt: null, error: null });
    const result = await phaseDef.execute(runId, body, (type, line) => {
      emitExecutionEvent(key, 'log', { type, line, ts: Date.now() });
    });
    emitExecutionEvent(key, 'status', { status: 'done', phase: params.phase, result });
    updateExecState(runId, params.phase, { status: 'done', endedAt: Date.now() });
  } catch (err) {
    emitExecutionEvent(key, 'status', { status: 'error', phase: params.phase, error: err.message });
    updateExecState(runId, params.phase, { status: 'error', endedAt: Date.now(), error: err.message });
  } finally {
    runLocks.delete(runId);
  }
});

// Cancel the currently running phase: kill its child processes; the phase
// promise then rejects, which emits the error status and releases the lock.
addRoute('POST', 'api/runs/:id/cancel', (req, res, params) => {
  const runId = safeId(params.id);
  if (!runId || !getRunDir(runId)) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const lock = runLocks.get(runId);
  if (!lock) { sendJSON(res, 200, { ok: false, error: 'No phase is running' }); return; }
  const killed = killRun(runId);
  sendJSON(res, 200, { ok: true, phase: lock.phase, killed });
});

// Phase info
addRoute('GET', 'api/runs/:id/phases', (req, res, params) => {
  const dir = getRunDir(params.id);
  if (!dir) { sendJSON(res, 404, { error: 'Not found' }); return; }
  const detected = detectPhases(dir);
  const runId = safeId(params.id);
  const execState = readExecState(dir);
  const liveLock = runLocks.get(runId);
  sendJSON(res, 200, {
    runningPhase: liveLock ? liveLock.phase : null,
    phases: EXEC_PHASE_ORDER.map((key) => {
      const st = execState[key] || {};
      let lastStatus = st.status || null;
      // Persisted "running" without a live lock = interrupted (e.g. server restart)
      if (lastStatus === 'running' && (!liveLock || liveLock.phase !== key)) lastStatus = 'interrupted';
      return {
        key,
        label: PHASES[key].label,
        description: PHASES[key].description,
        needsLLM: PHASES[key].needsLLM,
        runnable: true,
        completed: phaseCompleted(key, dir, detected),
        lastStatus,
        lastError: st.error || null,
        endedAt: st.endedAt || null,
      };
    }),
  });
});

function phaseCompleted(key, dir, detected) {
  switch (key) {
    case 'understand-images': {
      const src = readJSON(path.join(dir, 'lesson-source.json'));
      return !!(src && (src._vision_raw || (typeof src.raw_text === 'string' && src.raw_text.trim())));
    }
    case 'generate-outline': return detected.includes('outline-draft') || detected.includes('outline-approved');
    case 'generate-style-lock': return detected.includes('style-locked');
    case 'generate-master': return detected.includes('master-generated') || detected.includes('master-approved');
    case 'generate-scenes': return detected.includes('scenes-generated');
    case 'compose-html': return detected.includes('html-composed');
    case 'compose-pptx': return detected.includes('pptx-delivered');
    case 'deliver': return detected.includes('pptx-delivered') && fs.existsSync(path.join(dir, 'output', 'speaker-notes.md'));
    default: return false;
  }
}

// ---- Server ----
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const r = matchRoute(req.method, pathname);
  if (r) {
    Promise.resolve(r.handler(req, res, r.params)).catch((err) => {
      console.error(`[${req.method} ${pathname}] unhandled error:`, err);
      if (!res.headersSent) sendJSON(res, 500, { error: 'Internal server error' });
    });
    return;
  }
  send(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`bible-class UI → http://localhost:${PORT}`);
  console.log(`Runs root: ${RUNS_ROOT}`);
});
