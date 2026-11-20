'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PPT_AGENT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PPTX_ROOT = path.resolve(PPT_AGENT_ROOT, '..', 'ppt-agent-workflow-san', 'html-slide-to-pptx');

const PRESETS_DIR = path.join(PPT_AGENT_ROOT, 'skills', '_shared', 'references', 'styles', 'children');
const { validateLessonOutline } = require(path.join(PPT_AGENT_ROOT, 'skills', 'bible-class', 'lib', 'lesson_schema.js'));
const { renderCraftMarkdown } = require(path.join(PPT_AGENT_ROOT, 'skills', 'bible-class', 'lib', 'craft_writer.js'));

// Minimal flat-field YAML reader for the preset files (image_aspect + style_block |
// and identity_block_template |). Mirrors scripts/write_style_lock.js's parseYamlBlock.
function readPresetYaml(presetFile) {
  const raw = fs.readFileSync(presetFile, 'utf8');
  const result = {};
  const lines = raw.split('\n');
  let currentKey = null;
  let blockLines = null;
  for (const line of lines) {
    if (blockLines !== null) {
      if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
        blockLines.push(line);
        continue;
      } else {
        result[currentKey] = blockLines.join('\n').trimEnd();
        blockLines = null;
        currentKey = null;
      }
    }
    const blockMatch = line.match(/^([a-z_]+):\s*\|\s*$/);
    if (blockMatch) { currentKey = blockMatch[1]; blockLines = []; continue; }
    const simpleMatch = line.match(/^([a-z_]+):\s*"?([^"]*)"?\s*$/);
    if (simpleMatch) result[simpleMatch[1]] = simpleMatch[2].trim();
  }
  if (currentKey && blockLines) result[currentKey] = blockLines.join('\n').trimEnd();
  return result;
}

function readRunMeta(rd) {
  try { return JSON.parse(fs.readFileSync(path.join(rd, 'run-meta.json'), 'utf8')); } catch { return {}; }
}

// Selectable image-generation models (image-gen registry). Empty string means
// "no explicit choice" → generate.js falls back to its historical default.
const IMAGE_MODEL_IDS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst', 'gemini-3.1-flash-image'];
function resolveImageModel(opts, rd) {
  const m = (opts && opts.imageModel) || readRunMeta(rd).imageModel || '';
  return IMAGE_MODEL_IDS.includes(m) ? m : '';
}

function getRunDir(runId) {
  return path.join(PPT_AGENT_ROOT, 'openspec', 'changes', runId);
}

// Registry of live child processes per run, so a phase can be cancelled.
const activeChildren = new Map(); // runId -> Set<child>
function trackChild(runId, child) {
  if (!runId) return;
  let set = activeChildren.get(runId);
  if (!set) { set = new Set(); activeChildren.set(runId, set); }
  set.add(child);
  child.on('close', () => {
    set.delete(child);
    if (!set.size) activeChildren.delete(runId);
  });
}
function killRun(runId) {
  const set = activeChildren.get(runId);
  if (!set || !set.size) return false;
  for (const child of set) {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  return true;
}

function spawnLog(cmd, args, opts, onLine) {
  return new Promise((resolve, reject) => {
    const { _runId, ...spawnOpts } = opts || {};
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], ...spawnOpts });
    trackChild(_runId, child);
    // Close stdin immediately — CLIs like codex/gemini wait for stdin EOF
    // when it is an open pipe, which hangs the phase indefinitely.
    if (child.stdin) child.stdin.end();
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      s.split('\n').filter(Boolean).forEach((l) => onLine('out', l));
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      s.split('\n').filter(Boolean).forEach((l) => onLine('err', l));
    });
    child.on('close', (code) => {
      onLine('info', `Process exited with code ${code}`);
      if (code === 0) resolve(stdout);
      else reject(new Error(`Exit code ${code}: ${stderr.slice(-500)}`));
    });
    child.on('error', (err) => reject(err));
  });
}

function claudePrompt(agent, prompt, onLine, runId) {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--agent', agent,
    '--allowedTools', 'Read', 'Write', 'Bash', 'Skill', 'WebSearch',
    '--max-turns', '40',
  ];
  onLine('info', `$ claude -p --agent ${agent}`);
  return spawnLog('claude', args, { cwd: PPT_AGENT_ROOT, _runId: runId }, (type, line) => {
    if (type === 'out') {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant') {
          const text = obj.message?.content?.map(c => c.text || '').join('') || '';
          if (text) onLine('claude', text);
        } else if (obj.type === 'result') {
          onLine('result', obj.result || '');
        }
      } catch {
        onLine('out', line);
      }
    } else {
      onLine(type, line);
    }
  });
}

const phases = {
  'generate-outline': {
    label: '生成大纲',
    description: '使用所选 AI 模型生成 lesson-outline.json（含场景图片提示词）',
    needsLLM: true,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const model = opts.model || readRunMeta(rd).model || 'claude';
      onLine('info', `Using model: ${model}`);

      const feedback = (opts.feedback || '').trim();
      if (feedback) onLine('info', `Regenerating with feedback: ${feedback}`);

      if (model === 'claude') {
        const prompt = feedback
          ? `run_dir=${rd} mode=lesson_revise feedback=${feedback}`
          : `run_dir=${rd} mode=lesson_outline`;
        await claudePrompt('ppt-agent:content-core', prompt, onLine, runId);
      } else {
        const prompt = buildOutlinePrompt(rd, feedback);
        let rawText;
        if (model === 'gpt') {
          rawText = await runCodexText(prompt, rd, onLine, runId);
        } else if (model === 'gemini') {
          rawText = await runGeminiText(prompt, rd, onLine, runId);
        } else {
          throw new Error(`Unknown model: ${model}`);
        }
        finalizeOutline(rd, rawText, onLine);
      }
      return { files: ['lesson-outline.json', 'lesson-outline.md', 'craft.md'] };
    },
  },

  'generate-style-lock': {
    label: '风格锁定',
    description: '生成 style.lock.json + identity/style 文本',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const preset = opts.preset || 'flat-cartoon';
      const presetFile = path.join(PRESETS_DIR, `${preset}.yaml`);
      if (!fs.existsSync(presetFile)) throw new Error(`Preset file not found: ${presetFile}`);

      // Minimal YAML reader reused from write_style_lock.js CLI (flat fields only).
      const presetYaml = readPresetYaml(presetFile);
      onLine('info', `Style preset: ${preset}（重新生成 style.lock.json / identity / style 文本）`);

      // Read the outline once.
      let outline = null;
      try {
        outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      } catch { /* outline not yet written — fall through to single-char path */ }

      // ── Multi-character path (preferred) ────────────────────────────────────
      // When the outline carries a `characters` map (protagonist + supporting),
      // write per-character identity files and a characters field in style.lock.json.
      const chars = outline && outline.characters;
      const order = outline && Array.isArray(outline.characters_order) ? outline.characters_order : [];
      if (opts.characterDesc) {
        // Teacher override: single character (backward-compat path).
        onLine('info', `Using teacher-supplied characterDesc (single character)`);
        const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');
        const lock = buildStyleLock({ preset, presetYaml, characterDesc: opts.characterDesc });
        writeStyleLock(rd, lock);
      } else if (chars && typeof chars === 'object' && order.length > 0 && chars[order[0]]) {
        // Multi-character path.
        const names = order.map((k) => chars[k] && chars[k].character_name).filter(Boolean);
        onLine('info', `Using scripture-grounded characters from outline: ${names.join(' + ')}`);
        const { writeMultiCharStyleLock } = require('../lib/style_lock');
        writeMultiCharStyleLock(rd, { preset, presetYaml, characters: chars, charactersOrder: order });
      } else {
        // Single-character fallback (no characters map in outline).
        const profile = outline && outline.character_profile;
        let singleDesc;
        if (profile && typeof profile === 'object' && profile.character_name) {
          onLine('info', `Using scripture-grounded character_profile from outline: ${profile.character_name}, ${profile.age_appearance}`);
          singleDesc = profile;
        } else {
          const fallback = {
            character_name: '摩西',
            age_appearance: '60-80岁老年',
            ethnicity: '1世纪前希伯来/近东地区',
            hair_description: '花白齐肩长发，花白长胡须',
            clothing: '粗布及踝长袍，斜挎肩头的素色斗篷，棕色皮凉鞋，手持一根木杖',
            palette: '赭褐、沙土褐、米白、深蓝',
          };
          const outlineAge = outline && (outline.character_age || '').trim();
          if (outlineAge) {
            onLine('info', `No character_profile; using character_age from outline: ${outlineAge} (⚠️ other fields default to Moses)`);
            singleDesc = { ...fallback, age_appearance: outlineAge };
          } else {
            onLine('info', 'No character_profile/characters in outline; using Moses default.');
            singleDesc = fallback;
          }
        }
        const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');
        const lock = buildStyleLock({ preset, presetYaml, characterDesc: singleDesc });
        writeStyleLock(rd, lock);
      }
      return { files: ['style.lock.json', 'style.lock.identity.txt', 'style.lock.style.txt'] };
    },
  },

  'generate-master': {
    label: '生成定妆照',
    description: '生成 master-reference.png（多角色时为每个角色生成）',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const briefsDir = path.join(rd, 'briefs');
      if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
      const masterDir = path.join(rd, 'master');
      if (!fs.existsSync(masterDir)) fs.mkdirSync(masterDir, { recursive: true });

      const outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      const lock = JSON.parse(fs.readFileSync(path.join(rd, 'style.lock.json'), 'utf8'));
      const script = path.join(PPT_AGENT_ROOT, 'skills', 'image-gen', 'scripts', 'generate.js');
      const imageModel = resolveImageModel(opts, rd);
      if (imageModel) onLine('info', `Image model: ${imageModel}`);
      const modelFlags = imageModel ? ['--model', imageModel] : [];
      const portraitClause = 'STRICTLY NEUTRAL calm expression (no smile, no emotion), relaxed natural standing pose, front-facing, arms at sides, plain simple background, clear full-body view. This image is an identity/costume reference sheet for later illustrations, not a story scene.\nAspect: 4:3';

      // Determine the set of characters to render. Multi-character path uses
      // lock.characters + lock.characters_order (written by writeMultiCharStyleLock).
      // The first entry is the main protagonist; its output goes to the backward-compat
      // master-reference.png path.
      const order = Array.isArray(lock.characters_order) && lock.characters_order.length > 0
        ? lock.characters_order
        : null;
      const charsMap = lock.characters && typeof lock.characters === 'object' ? lock.characters : null;

      const files = [];
      if (order && charsMap) {
        // Multi-character path: one master per role_key.
        for (let i = 0; i < order.length; i++) {
          const roleKey = order[i];
          const entry = charsMap[roleKey];
          if (!entry) { onLine('err', `characters_order lists "${roleKey}" but no entry in characters`); continue; }
          const identityBlock = entry.identity_block || lock.identity_block;
          // Main protagonist keeps backward-compat label 'master' + path 'master-reference.png'.
          const label = i === 0 ? 'master' : `master-${roleKey}`;
          const outName = i === 0 ? 'master-reference.png' : `${roleKey}.png`;
          const briefName = i === 0 ? 'master.txt' : `master-${roleKey}.txt`;
          const idFile = i === 0
            ? path.join(rd, 'style.lock.identity.txt')
            : path.join(rd, `style.lock.identity.${roleKey}.txt`);
          const outPath = path.join(masterDir, outName);
          // Skip regeneration when the master already exists (unless forced) — keeps
          // approved masters and saves cost when adding a NEW character to an existing run.
          if (fs.existsSync(outPath) && !opts.forceMaster) {
            onLine('info', `master/${outName} already exists — skip (delete it or pass forceMaster to redo)`);
            files.push(`master/${outName}`);
            continue;
          }
          // Group characters (e.g. ten lepers) get a GROUP reference sheet instead of
          // a single portrait, so the same people recur across scenes.
          const isGroup = entry.reference_kind === 'group';
          const groupClause = isGroup
            ? `GROUP character reference sheet: exactly ${entry.group_size || 'the story\'s'} people standing together in a loose row, all with calm NEUTRAL expressions, full-body view, plain simple background. These SAME people must look IDENTICAL (same faces, hair, clothing colors) whenever they reappear in later story scenes. This is a reference sheet, not a story scene.\nAspect: 4:3`
            : portraitClause;
          const briefText = `${identityBlock}\n\n${lock.style_block}\n\nScene: ${outline.title} - ${entry.character_name || roleKey} ${isGroup ? 'group reference' : 'character reference portrait'}. ${groupClause}`;
          const briefFile = path.join(briefsDir, briefName);
          fs.writeFileSync(briefFile, briefText);
          onLine('info', `Wrote master brief for ${entry.character_name || roleKey} (${roleKey}${isGroup ? ', group' : ''})`);
          await spawnLog('node', [
            script, '--run-dir', rd, '--label', label,
            ...modelFlags,
            '--out', outPath,
            '--prompt-file', briefFile,
            '--identity-file', idFile,
            '--style-file', path.join(rd, 'style.lock.style.txt'),
          ], { cwd: PPT_AGENT_ROOT, _runId: runId }, onLine);
          files.push(`master/${outName}`);
        }
      } else {
        // Single-character path (backward compat).
        const masterBrief = `${lock.identity_block}\n\n${lock.style_block}\n\nScene: ${outline.title} - character reference portrait. ${portraitClause}`;
        fs.writeFileSync(path.join(briefsDir, 'master.txt'), masterBrief);
        onLine('info', 'Wrote master brief');
        await spawnLog('node', [
          script, '--run-dir', rd, '--label', 'master',
          ...modelFlags,
          '--out', path.join(masterDir, 'master-reference.png'),
          '--prompt-file', path.join(briefsDir, 'master.txt'),
          '--identity-file', path.join(rd, 'style.lock.identity.txt'),
          '--style-file', path.join(rd, 'style.lock.style.txt'),
        ], { cwd: PPT_AGENT_ROOT, _runId: runId }, onLine);
        files.push('master/master-reference.png');
      }
      return { files };
    },
  },

  'generate-scenes': {
    label: '批量生成场景图',
    description: '使用 generate_batch.js 并发生成所有场景图',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      const scenes = outline.teaching.scenes;
      const briefsDir = path.join(rd, 'briefs');
      if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
      const imagesDir = path.join(rd, 'images');
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      const imageModel = resolveImageModel(opts, rd);
      if (imageModel) onLine('info', `Image model: ${imageModel}`);

      // Multi-character support: build the per-role master png path map from
      // style.lock.json. The main protagonist maps to master-reference.png; each
      // supporting role maps to master/<roleKey>.png.
      const lock = JSON.parse(fs.readFileSync(path.join(rd, 'style.lock.json'), 'utf8'));
      const order = Array.isArray(lock.characters_order) ? lock.characters_order : [];
      const charsMap = lock.characters && typeof lock.characters === 'object' ? lock.characters : null;
      const multiChar = !!(order.length && charsMap);
      // roleKey → absolute master png path
      const masterPathByRole = {};
      if (multiChar) {
        order.forEach((roleKey, i) => {
          masterPathByRole[roleKey] = i === 0
            ? path.join(rd, 'master', 'master-reference.png')
            : path.join(rd, 'master', `${roleKey}.png`);
        });
      }
      const mainMaster = path.join(rd, 'master', 'master-reference.png');

      // Resolve which reference images to pass for a given scene, based on its
      // `characters` array. Falls back to main protagonist only when no characters
      // list is present (backward compat) or the list is empty.
      function resolveReferences(scene) {
        if (!multiChar) return { refs: [mainMaster], roles: [] };
        const list = Array.isArray(scene.characters) ? scene.characters : [];
        const refs = [];
        const roles = [];
        for (const roleKey of list) {
          const p = masterPathByRole[roleKey];
          if (p && fs.existsSync(p)) { refs.push(p); roles.push(roleKey); }
        }
        // Always include the main protagonist as a fallback when no role matched.
        if (refs.length === 0 && fs.existsSync(mainMaster)) {
          refs.push(mainMaster);
          roles.push(order[0]);
        }
        return { refs, roles };
      }

      // The reference image is an identity sheet only — scenes must re-pose
      // and re-stage the character(s) so they blend naturally into each picture.
      // Built PER SCENE so image numbering matches the actually-attached references
      // and group characters (e.g. ten lepers) are described correctly.
      const SINGLE_REF_RULES = `Reference usage rules:
- The attached reference image defines ONLY the character's facial features, hairstyle, beard and clothing/costume. Keep these consistent.
- Do NOT copy the reference image's pose, expression, camera angle, framing, lighting or background.
- EXPRESSION: ignore the reference image's expression entirely (even if it smiles). The character's expression MUST match this scene's emotional tone — solemn scenes need serious/worried faces, joyful scenes need happy faces. Never default to a smile.
- SCALE: the main character must be drawn at the same realistic human scale as every other person in the scene — same head-to-body ratio and consistent perspective with the crowd. Do NOT enlarge the main character to make them prominent; use placement and composition instead.
- The character must blend naturally into the scene's composition, scale and lighting — never look pasted-in or stiffly front-facing unless the scene calls for it.`;

      function refRulesFor(roles) {
        if (!multiChar || roles.length === 0) return SINGLE_REF_RULES;
        const listing = roles.map((roleKey, idx) => {
          const entry = charsMap[roleKey] || {};
          const name = entry.character_name || roleKey;
          return entry.reference_kind === 'group'
            ? `image ${idx + 1} = ${name} — the WHOLE GROUP of ${entry.group_size || 'the same'} people; every member's face and clothing must match and recur identically in other scenes`
            : `image ${idx + 1} = ${name}`;
        }).join('; ');
        return `Reference usage rules:
- Multiple reference images are attached — EACH ONE is an identity sheet defining ONE character or ONE character GROUP (facial features, hairstyle, beard, clothing). Keep each consistent across scenes.
- Correspondence: ${listing}.
- Only draw the characters/groups called for by this scene's image_brief; do not force every attached reference into the scene.
- Do NOT copy any reference image's pose, expression, camera angle, framing, lighting or background.
- EXPRESSION: ignore the reference images' expressions entirely. Each character's expression MUST match this scene's emotional tone — solemn scenes need serious/worried faces, joyful scenes need happy faces.
- STATE CHANGES (e.g. sick → healed): keep the SAME people (same faces, hair, clothing) and only change what the scene's image_brief specifies (e.g. skin healed, white patches gone).
- SCALE: every character must be drawn at the same realistic human scale — same head-to-body ratio and consistent perspective. Do NOT enlarge the main character; use placement and composition instead.`;
      }

      const jobs = [];
      for (const s of scenes) {
        const nn = String(s.index).padStart(2, '0');
        const { refs, roles } = resolveReferences(s);
        const briefText = `${fs.readFileSync(path.join(rd, 'style.lock.identity.txt'), 'utf8')}\n\n${fs.readFileSync(path.join(rd, 'style.lock.style.txt'), 'utf8')}\n\n${refRulesFor(roles)}\n\nScene ${nn}: ${s.title}\n${s.image_brief}\nAspect: 4:3`;
        const briefFile = path.join(briefsDir, `scene-${nn}.txt`);
        fs.writeFileSync(briefFile, briefText);
        const job = {
          runDir: rd,
          label: `scene-${nn}`,
          out: path.join(rd, 'images', `scene-${nn}.png`),
          promptFile: briefFile,
          identityFile: path.join(rd, 'style.lock.identity.txt'),
          styleFile: path.join(rd, 'style.lock.style.txt'),
          references: refs,            // plural array; generate.js accepts this directly
          // No backend pin — generate.js routes by model (gemini models must
          // not hit the OpenAI endpoint); unset model keeps the openai-fetch default.
          model: imageModel || undefined,
        };
        jobs.push(job);
      }
      const jobsFile = path.join(briefsDir, '_jobs.json');
      fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
      onLine('info', `Wrote ${jobs.length} jobs to _jobs.json${multiChar ? ` (multi-character: ${order.join(', ')})` : ''}`);

      const script = path.join(PPT_AGENT_ROOT, 'skills', 'image-gen', 'scripts', 'generate_batch.js');
      await spawnLog('node', [script, '--jobs-file', jobsFile, '--concurrency', String(opts.concurrency || 3)], { cwd: PPT_AGENT_ROOT, _runId: runId }, onLine);
      return { files: scenes.map((s) => `images/scene-${String(s.index).padStart(2, '0')}.png`) };
    },
  },

  'redo-scenes': {
    label: '重画已标记场景',
    description: '只重新生成被 Redo 标记的场景图，拒绝原因会写入提示词',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const manifest = JSON.parse(fs.readFileSync(path.join(rd, 'image-manifest.json'), 'utf8'));
      const outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      const redoKeys = Object.keys(manifest.entries || {})
        .filter((k) => k.startsWith('scene-') && manifest.entries[k].needsRedo);
      if (!redoKeys.length) { onLine('info', '没有被标记 Redo 的场景'); return { files: [] }; }
      onLine('info', `重画 ${redoKeys.length} 个场景: ${redoKeys.join(', ')}`);

      const script = path.join(PPT_AGENT_ROOT, 'skills', 'image-gen', 'scripts', 'generate.js');
      const imageModel = resolveImageModel(opts, rd);
      const modelFlags = imageModel ? ['--model', imageModel] : [];
      const files = [];
      for (const key of redoKeys) {
        const nn = key.slice('scene-'.length);
        const scene = outline.teaching.scenes.find((s) => String(s.index).padStart(2, '0') === nn);
        if (!scene) { onLine('err', `${key}: outline 中找不到对应场景，跳过`); continue; }
        const reason = manifest.entries[key].redoReason || '';
        const briefFile = path.join(rd, 'briefs', `scene-${nn}.txt`);
        let brief = fs.existsSync(briefFile) ? fs.readFileSync(briefFile, 'utf8') : `Scene ${nn}: ${scene.title}\n${scene.image_brief}\nAspect: 4:3`;
        if (reason) {
          brief += `\n\nIMPORTANT — the previous version of this image was REJECTED by the teacher for this reason; you MUST fix it:\n${reason}`;
          fs.writeFileSync(briefFile, brief);
        }
        onLine('info', `重画 ${key}${reason ? `（原因: ${reason}）` : ''}...`);
        // Resolve references (multi-character aware): join the scene's character
        // master pngs as a comma-separated --reference value (generate.js splits on comma).
        const redoLock = JSON.parse(fs.readFileSync(path.join(rd, 'style.lock.json'), 'utf8'));
        const redoOrder = Array.isArray(redoLock.characters_order) ? redoLock.characters_order : [];
        const redoChars = redoLock.characters && typeof redoLock.characters === 'object' ? redoLock.characters : null;
        const redoMain = path.join(rd, 'master', 'master-reference.png');
        let redoRefs = redoMain;
        if (redoOrder.length && redoChars && Array.isArray(scene.characters)) {
          const list = [];
          scene.characters.forEach((roleKey) => {
            const idx = redoOrder.indexOf(roleKey);
            const p = idx === 0 ? redoMain : path.join(rd, 'master', `${roleKey}.png`);
            if (fs.existsSync(p)) list.push(p);
          });
          if (list.length === 0) list.push(redoMain);
          redoRefs = list.join(',');
        }
        await spawnLog('node', [
          script,
          '--run-dir', rd,
          '--label', key,
          '--redo',
          ...modelFlags,
          '--out', path.join(rd, 'images', `scene-${nn}.png`),
          '--prompt-file', briefFile,
          '--identity-file', path.join(rd, 'style.lock.identity.txt'),
          '--style-file', path.join(rd, 'style.lock.style.txt'),
          '--reference', redoRefs,
        ], { cwd: PPT_AGENT_ROOT, _runId: runId }, onLine);
        // Clear the redo flag (re-read manifest: generate.js also writes it).
        const m2 = JSON.parse(fs.readFileSync(path.join(rd, 'image-manifest.json'), 'utf8'));
        if (m2.entries[key]) { m2.entries[key].needsRedo = false; }
        fs.writeFileSync(path.join(rd, 'image-manifest.json'), JSON.stringify(m2, null, 2) + '\n');
        files.push(`images/scene-${nn}.png`);
        onLine('info', `✓ ${key} 重画完成`);
      }
      return { files };
    },
  },

  'compose-html': {
    label: '合成 HTML 幻灯片',
    description: '运行 html_compose.js 生成 slide HTML 文件',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const script = path.join(PPT_AGENT_ROOT, 'skills', 'bible-class', 'scripts', 'compose_html_runner.js');
      await spawnLog('node', [script, rd], { cwd: PPT_AGENT_ROOT, _runId: runId }, onLine);
      return { files: ['slides/'] };
    },
  },

  'compose-pptx': {
    label: '合成 PPTX',
    description: '运行 compose_pptx.js 生成 presentation.pptx',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      const outlineTitle = outline.title || 'Untitled';
      const outputDir = path.join(rd, 'output');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const script = path.join(PPTX_ROOT, 'scripts', 'compose_pptx.js');
      await spawnLog('node', [
        script,
        '--slides-dir', path.join(rd, 'slides'),
        '--output', path.join(outputDir, 'presentation.pptx'),
        '--dump-model', path.join(outputDir, 'slides-model.json'),
        '--title', outlineTitle,
      ], { cwd: PPTX_ROOT, _runId: runId }, onLine);
      return { files: ['output/presentation.pptx'] };
    },
  },

  'deliver': {
    label: '交付打包',
    description: '复制图片到 output、生成 index.html、speaker-notes.md、craft.md',
    needsLLM: false,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const outputDir = path.join(rd, 'output');
      const outputImages = path.join(outputDir, 'images');
      if (!fs.existsSync(outputImages)) fs.mkdirSync(outputImages, { recursive: true });

      // Copy scene images to output (pure Node, no shell)
      const srcImages = path.join(rd, 'images');
      if (fs.existsSync(srcImages)) {
        const pngFiles = fs.readdirSync(srcImages).filter(f => f.endsWith('.png'));
        for (const f of pngFiles) {
          fs.copyFileSync(path.join(srcImages, f), path.join(outputImages, f));
        }
        onLine('info', `Copied ${pngFiles.length} images`);
      } else {
        onLine('info', 'No images directory found, skipping copy');
      }

      const outline = JSON.parse(fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'));
      const lines = ['# 讲稿 / Speaker Notes', '', `**课题：** ${outline.title}`, `**经文：** ${outline.scripture_ref}`, '', '---', ''];
      for (const s of outline.teaching.scenes) {
        const nn = String(s.index).padStart(2, '0');
        lines.push(`## 第 ${nn} 幅：${s.title}`, '', `**旁白：** ${s.narration}`, '', `**互动：** ${s.interaction}`, '');
      }
      if (outline.memory_verse && outline.memory_verse.text) {
        lines.push('---', '', '## 金句', '', `> ${outline.memory_verse.text}`, '>', `> ——${outline.memory_verse.ref}`, '');
      }
      fs.writeFileSync(path.join(outputDir, 'speaker-notes.md'), lines.join('\n'));
      onLine('info', 'Wrote speaker-notes.md');

      if (fs.existsSync(path.join(rd, 'craft.md'))) {
        fs.copyFileSync(path.join(rd, 'craft.md'), path.join(outputDir, 'craft.md'));
        onLine('info', 'Copied craft.md');
      }

      onLine('info', 'Delivery complete');
      return { files: ['output/'] };
    },
  },

  'understand-images': {
    label: '理解教案图片',
    description: '使用选定的 AI 模型分析上传的教案图片，提取课程信息',
    needsLLM: true,
    async execute(runId, opts, onLine) {
      const rd = getRunDir(runId);
      const imgDir = path.join(rd, 'input-images');
      const model = opts.model || readRunMeta(rd).model || 'claude';
      opts._runId = runId;
      onLine('info', `Using model: ${model}`);

      if (!fs.existsSync(imgDir) || !fs.readdirSync(imgDir).length) {
        throw new Error('No input images found. Please upload lesson plan images first.');
      }

      const images = fs.readdirSync(imgDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();
      onLine('info', `Found ${images.length} images`);

      const imagePaths = images.map((f) => path.join(imgDir, f));
      let result = '';

      if (model === 'claude') {
        result = await runClaudeVision(imagePaths, opts, onLine);
      } else if (model === 'gpt') {
        result = await runCodexVision(imagePaths, opts, onLine);
      } else if (model === 'gemini') {
        result = await runGeminiVision(imagePaths, opts, onLine);
      } else {
        throw new Error(`Unknown model: ${model}`);
      }

      const sourceFile = path.join(rd, 'lesson-source.json');
      let source;
      if (fs.existsSync(sourceFile)) {
        source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
      } else {
        source = { title: '', scripture_ref: '', material_name: '', age_group: '3-5', core_points: [], source_kind: 'image' };
      }
      // Parse the model's JSON and merge structured fields so the run-detail
      // page can display 课题/经文/要点 instead of just raw text.
      try {
        const parsed = parseJsonLoose(result);
        for (const f of ['title', 'scripture_ref', 'material_name', 'age_group', 'raw_text', 'teaching_content', 'craft_idea']) {
          if (parsed[f]) source[f] = parsed[f];
        }
        if (Array.isArray(parsed.core_points) && parsed.core_points.length) source.core_points = parsed.core_points;
        if (parsed.memory_verse && parsed.memory_verse.text) source.memory_verse = parsed.memory_verse;
        onLine('info', `Parsed vision JSON: ${source.title || '(no title)'}`);
      } catch (e) {
        onLine('err', `Vision output was not parseable JSON (${e.message}); keeping raw text only`);
        source.raw_text = result;
      }
      source._vision_raw = result;
      writeJSONSync(sourceFile, source);
      onLine('info', 'Updated lesson-source.json with vision results');
      return { files: ['lesson-source.json'] };
    },
  },
};

function writeJSONSync(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
}

async function runClaudeVision(imagePaths, opts, onLine) {
  const fileList = imagePaths.map((p) => `- ${p}`).join('\n');
  const prompt = `You are a Sunday school lesson plan reader. I will give you ${imagePaths.length} image file paths of a Chinese lesson plan (教案) for 3-5 year old children.

Please READ each image file using the Read tool, then extract and output the following in this EXACT JSON format:
{
  "title": "lesson title in Chinese",
  "scripture_ref": "bible reference e.g. 出埃及记 14",
  "material_name": "teaching material name",
  "age_group": "3-5",
  "core_points": ["point 1", "point 2", ...],
  "raw_text": "full text content from all images concatenated",
  "teaching_content": "detailed teaching content",
  "craft_idea": "any craft activity mentioned",
  "memory_verse": {"text": "verse text", "ref": "reference"}
}

Image files to read:
${fileList}

IMPORTANT: Read EVERY image file first, then produce the JSON output.`;

  onLine('info', `$ claude -p --model claude-opus-5-5`);
  const args = [
    '-p', prompt,
    '--model', 'claude-opus-5-5',
    '--output-format', 'stream-json',
    '--verbose',
    '--allowedTools', 'Read',
    '--max-turns', '20',
  ];
  let result = '';
  await spawnLog('claude', args, { cwd: PPT_AGENT_ROOT, _runId: opts._runId }, (type, line) => {
    if (type === 'out') {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant') {
          const text = obj.message?.content?.map((c) => c.text || '').join('') || '';
          if (text) { result += text; onLine('claude', text); }
        } else if (obj.type === 'result') {
          onLine('result', obj.result?.slice(0, 200) || '');
        }
      } catch {
        onLine('out', line);
      }
    } else {
      onLine(type, line);
    }
  });
  return result;
}

// Distilled from agents/content-core.md mode=lesson_outline, for non-claude CLIs
// that cannot load the claude agent definition. Schema validation and craft.md
// rendering happen deterministically server-side in finalizeOutline().
function buildOutlinePrompt(rd, feedback) {
  const source = fs.readFileSync(path.join(rd, 'lesson-source.json'), 'utf8');
  let revisionBlock = '';
  if (feedback) {
    let prev = '';
    try { prev = fs.readFileSync(path.join(rd, 'lesson-outline.json'), 'utf8'); } catch { /* no previous */ }
    revisionBlock = `

The teacher REJECTED the previous outline with this feedback — revise accordingly (keep what was not criticized):
<feedback>
${feedback}
</feedback>
${prev ? `<previous-outline>\n${prev}\n</previous-outline>` : ''}`;
  }
  return `You are a Sunday school curriculum writer for 3-5 year old children.${revisionBlock}

Below is lesson-source.json. It is the SOLE content source — do NOT introduce theological positions, extra Bible passages, or doctrinal commentary beyond what it states.

<lesson-source.json>
${source}
</lesson-source.json>

Output ONLY a single JSON object (no markdown fences, no commentary) with this exact structure:
- "title": lesson title from lesson-source.json
- "approved": false (always)
- "scripture_ref": from lesson-source.json
- "character_age": the main biblical character's age at this story's event, as a string in the form "<age> (<scripture basis in Chinese, book chapter:verse>)". Determine it from your knowledge of scripture and the event in scripture_ref (e.g. 耶稣降生=婴儿/马太福音2:1-2; 12岁在圣殿=约12岁男孩/路加福音2:42; 受洗传道=约30岁/路加福音3:23; 摩西出埃及=60-80岁老年/使徒行传7:23,30). Give the concrete scripture basis. If you cannot determine the age confidently, set this to an empty string "". Example: "约30岁（路加福音3:23 耶稣开头传道时年纪约有三十岁）". This age will be used for the character's master reference image, so accuracy matters — a wrong age misleads young children.
- "character_profile": a complete character profile object for the story's MAIN protagonist. First IDENTIFY who the protagonist is from raw_text/teaching_content (do NOT assume — it varies by story: David for Psalm 139, Moses for Exodus, Jesus for Gospels, etc.). Then fill all 6 keys: "character_name" (e.g. 大卫/摩西/耶稣), "age_appearance" (same value as character_age), "ethnicity" (e.g. "公元前10世纪犹太/以色列地区" for David, "1世纪犹太/近东地区" for Jesus), "hair_description" (inferred from era/region, e.g. "棕色或黑色头发，留胡须"), "clothing" (era-appropriate, e.g. "亚麻及踝长袍、腰带、皮凉鞋"), "palette" (warm child-friendly colors). If you cannot identify the protagonist, set character_profile to null.
- "characters": a map of role_key → profile object for ALL characters needing a master reference. Include the protagonist (role="main") plus any IMPORTANT supporting character (role="supporting"). A supporting character qualifies ONLY if: appears in ≥2 scenes with specific actions/dialogue AND is named/semi-named (e.g. 盲人/blind man for John 9, 撒该/Zacchaeus for Luke 19, 拉撒路/Lazarus for John 11). Anonymous groups (門徒, 群眾, 小朋友) do NOT get profiles. Each profile has 7 keys: "character_name", "role" ("main"|"supporting"), "age_appearance", "ethnicity", "hair_description", "clothing", "palette". Use stable lowercase role_keys (e.g. "jesus", "blindman"). Most single-protagonist stories have NO supporting character — then the map contains only the protagonist. The protagonist's profile here MUST match character_profile. Set to null only if protagonist unknown.
- "characters_order": array of role_keys in order, protagonist first (e.g. ["jesus","blindman"]).
- "teaching": {
    "duration_min": 15,
    "scenes": [ ... ]  // derived from core_points and raw_text; scene count follows the story's natural narrative beats (typically 6-12, minimum 4); do not truncate a rich story or pad a simple one
  }
  Each scene object:
  - "index": 1-based integer
  - "title": short Chinese scene title (max 12 characters)
  - "key_message": the single theological truth for this scene, one sentence, derived ONLY from lesson-source.json
  - "narration": a SINGLE string (not an array) containing 2-3 sentences of spoken narration in 3-5岁口语 (simple vocabulary, concrete images, no abstract theology), max 60 characters per sentence
  - "interaction": one interactive question or action prompt for children
  - "image_brief": a vivid illustration description for image generation (subject, setting, mood, key visual elements; max 80 characters)
  - "characters": array of role_keys appearing in this scene (from the top-level "characters" map keys). Only list characters whose master reference should be passed when generating this scene (e.g. ["jesus","blindman"] for a Jesus+blind-man scene; ["blindman"] for blind-man-alone; ["jesus"] for Jesus-only). Empty array [] if no profiled character. Anonymous groups are NEVER listed.
- "craft": {
    "duration_min": 15,
    "title": short Chinese craft activity name,
    "materials": [simple craft materials],
    "steps": [numbered steps],
    "relation_to_story": one sentence connecting the craft to the Bible story
  }
- "memory_verse": { "text": short age-appropriate verse from lesson-source.json, "ref": "book chapter:verse" }

Remember: output ONLY the JSON object, nothing else.`;
}

// Single-shot text generation (no agentic file-writing loop — much faster).
async function runCodexText(prompt, cwd, onLine, runId) {
  const outputFile = path.join(os.tmpdir(), `codex-outline-${Date.now()}.txt`);
  onLine('info', `$ codex exec -m gpt-6.2-sol (single-shot)`);
  await spawnLog('codex', [
    'exec',
    '-m', 'gpt-6.2-sol',
    '-c', 'model_reasoning_effort=high',
    '-c', 'mcp_servers={}',
    '--dangerously-bypass-approvals-and-sandbox',
    '--color', 'never',
    '--output-last-message', outputFile,
    prompt,
  ], { cwd, _runId: runId }, onLine);
  if (fs.existsSync(outputFile)) {
    const text = fs.readFileSync(outputFile, 'utf8');
    fs.unlinkSync(outputFile);
    return text;
  }
  throw new Error('codex produced no output');
}

// The google `gemini` CLI is retired for individual accounts (IneligibleTierError,
// 2026-09) — Google's migration target is the Antigravity `agy` CLI, which keeps
// the same -p headless + @file image-reference pattern.
// NOTE: --model must precede -p (agy errors out when -p swallows the next flag).
function runGeminiText(prompt, cwd, onLine, runId) {
  onLine('info', `$ agy -m gemini-4-hydrogen-xhigh -p (single-shot)`);
  return spawnLog('agy', [
    '--model', 'gemini-4-hydrogen-xhigh',
    '--dangerously-skip-permissions',
    '-p', prompt,
  ], { cwd, _runId: runId }, onLine).then((stdout) =>
    stdout.split('\n').filter((l) => !/^(YOLO mode|Ripgrep is not available)/.test(l)).join('\n')
  );
}

// Extract the first JSON object from model output (tolerates fences/preamble).
function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function renderOutlineMarkdown(o) {
  const lines = [`# ${o.title}`, '', `**经文：** ${o.scripture_ref}`, '', '## 教学场景', ''];
  for (const s of o.teaching.scenes) {
    lines.push(`### ${s.index}. ${s.title}`, '', `- **要点：** ${s.key_message}`, `- **旁白：** ${s.narration}`, `- **互动：** ${s.interaction}`, `- **配图：** ${s.image_brief}`, '');
  }
  if (o.craft) {
    lines.push('## 手工活动', '', `**${o.craft.title}**（${o.craft.duration_min || 15} 分钟）`, '', `材料：${(o.craft.materials || []).join('、')}`, '');
    (o.craft.steps || []).forEach((st, i) => lines.push(`${i + 1}. ${st}`));
    if (o.craft.relation_to_story) lines.push('', `与故事的联系：${o.craft.relation_to_story}`);
    lines.push('');
  }
  if (o.memory_verse) {
    lines.push('## 金句', '', `> ${o.memory_verse.text}`, `>`, `> ——${o.memory_verse.ref}`, '');
  }
  return lines.join('\n');
}

// Server-side guarantee for non-claude outline runs: validate the model's JSON,
// then write all three artifacts deterministically.
function finalizeOutline(rd, rawText, onLine) {
  let outline;
  try {
    outline = parseJsonLoose(rawText);
  } catch (e) {
    throw new Error(`Model output is not valid JSON: ${e.message}`);
  }
  outline.approved = false;
  // Ensure character_age field exists (set in Phase 2 by scripture lookup; may be empty).
  if (typeof outline.character_age !== 'string') outline.character_age = '';
  // Ensure character_profile field exists (set in Phase 2; may be null if undetermined).
  if (outline.character_profile === undefined) outline.character_profile = null;
  // Ensure characters / characters_order exist (set in Phase 2; may be null if unknown).
  if (outline.characters === undefined) outline.characters = null;
  if (!Array.isArray(outline.characters_order)) outline.characters_order = [];
  // Ensure each scene has a characters array (default empty = protagonist-only fallback).
  if (outline.teaching && Array.isArray(outline.teaching.scenes)) {
    for (const s of outline.teaching.scenes) {
      if (!Array.isArray(s.characters)) s.characters = [];
    }
  }
  // Normalize common model quirks: sentence arrays → joined string.
  if (outline.teaching && Array.isArray(outline.teaching.scenes)) {
    for (const s of outline.teaching.scenes) {
      for (const f of ['narration', 'interaction', 'key_message', 'image_brief']) {
        if (Array.isArray(s[f])) s[f] = s[f].join('');
      }
    }
  }
  const v = validateLessonOutline(outline);
  if (!v.ok) {
    throw new Error(`lesson-outline failed schema validation:\n${v.errors.join('\n')}`);
  }
  onLine('info', 'Schema validation passed');
  fs.writeFileSync(path.join(rd, 'lesson-outline.json'), JSON.stringify(outline, null, 2) + '\n');
  fs.writeFileSync(path.join(rd, 'lesson-outline.md'), renderOutlineMarkdown(outline));
  fs.writeFileSync(path.join(rd, 'craft.md'), renderCraftMarkdown(outline));
  onLine('info', 'Wrote lesson-outline.json / lesson-outline.md / craft.md');
}

async function runCodexVision(imagePaths, opts, onLine) {
  const imgFlags = imagePaths.flatMap((p) => ['-i', p]);
  const prompt = `You are a Sunday school lesson plan reader. Analyze these ${imagePaths.length} images of a Chinese lesson plan (教案) for 3-5 year old children.

Extract and output ONLY a JSON object with these fields:
{"title":"lesson title","scripture_ref":"bible ref","material_name":"教材名","age_group":"3-5","core_points":["..."],"raw_text":"full content","teaching_content":"details","craft_idea":"craft activity","memory_verse":{"text":"...","ref":"..."}}

Output valid JSON only.`;

  const outputFile = path.join(path.dirname(path.dirname(imagePaths[0])), 'vision-codex-output.txt');
  onLine('info', `$ codex exec -m gpt-6.2-sol`);
  const args = [
    'exec',
    ...imgFlags,
    '-m', 'gpt-6.2-sol',
    '-c', 'model_reasoning_effort=high',
    '-c', 'mcp_servers={}',
    '--dangerously-bypass-approvals-and-sandbox',
    '--color', 'never',
    '--output-last-message', outputFile,
    prompt,
  ];
  let stdout = '';
  await new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: PPT_AGENT_ROOT,
    });
    trackChild(opts._runId, child);
    child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; s.split('\n').filter(Boolean).forEach((l) => onLine('out', l)); });
    child.stderr.on('data', (d) => { d.toString().split('\n').filter(Boolean).forEach((l) => onLine('err', l)); });
    child.on('close', (code) => { code === 0 ? resolve() : reject(new Error(`codex exit ${code}`)); });
    child.on('error', reject);
  });
  if (fs.existsSync(outputFile)) return fs.readFileSync(outputFile, 'utf8');
  return stdout;
}

async function runGeminiVision(imagePaths, opts, onLine) {
  // Run from the image directory so @file references resolve.
  const imgDir = path.dirname(imagePaths[0]);
  const fileRefs = imagePaths.map((p) => `@${path.basename(p)}`).join(' ');
  const prompt = `You are a Sunday school lesson plan reader. Read these ${imagePaths.length} lesson plan images: ${fileRefs}

After reading ALL images, extract and output ONLY a JSON object:
{"title":"lesson title","scripture_ref":"bible ref","material_name":"教材名","age_group":"3-5","core_points":["..."],"raw_text":"full content","teaching_content":"details","craft_idea":"craft activity","memory_verse":{"text":"...","ref":"..."}}

Output valid JSON only.`;

  onLine('info', `$ agy -m gemini-4-hydrogen-xhigh (${imagePaths.length} images via @file refs)`);
  // Headless file reads need tool permissions auto-approved (read-only prompt).
  const args = ['--model', 'gemini-4-hydrogen-xhigh', '--dangerously-skip-permissions', '-p', prompt];
  let stdout = '';
  await new Promise((resolve, reject) => {
    const child = spawn('agy', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: imgDir,
    });
    trackChild(opts._runId, child);
    child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; s.split('\n').filter(Boolean).forEach((l) => onLine('out', l)); });
    child.stderr.on('data', (d) => { d.toString().split('\n').filter(Boolean).forEach((l) => onLine('err', l)); });
    child.on('close', (code) => { code === 0 ? resolve() : reject(new Error(`agy exit ${code}`)); });
    child.on('error', reject);
  });
  // Strip CLI banner lines (e.g. "YOLO mode is enabled...") before the JSON payload.
  return stdout.split('\n').filter((l) => !/^(YOLO mode|Ripgrep is not available)/.test(l)).join('\n');
}

const PHASE_ORDER = [
  'understand-images',
  'generate-outline',
  'generate-style-lock',
  'generate-master',
  'generate-scenes',
  'compose-html',
  'compose-pptx',
  'deliver',
];

module.exports = { phases, PHASE_ORDER, getRunDir, PPT_AGENT_ROOT, killRun };
