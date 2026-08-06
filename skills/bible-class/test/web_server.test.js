'use strict';
const test = require('node:test');
const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const SERVER_PATH = path.join(__dirname, '..', 'web', 'server.js');
const PHASES_PATH = path.join(__dirname, '..', 'web', 'phases.js');
const DASHBOARD_PAGE_PATH = path.join(__dirname, '..', 'web', 'pages', 'dashboard.html');
const NEW_RUN_PAGE_PATH = path.join(__dirname, '..', 'web', 'pages', 'new-run.html');
const RUN_DETAIL_PAGE_PATH = path.join(__dirname, '..', 'web', 'pages', 'run-detail.html');
const PPT_AGENT_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNS_ROOT = path.join(PPT_AGENT_ROOT, 'openspec', 'changes');

function uniqueRunId(name) {
  return `bc-web-${process.pid}-${Date.now()}-${name}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(predicate, message, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error(message);
}

function request(port, method, requestPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path: requestPath,
      headers: {
        ...(payload ? { 'Content-Length': payload.length } : {}),
        ...headers,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (payload) req.end(payload);
    else req.end();
  });
}

async function startServer(t) {
  fs.mkdirSync(RUNS_ROOT, { recursive: true });
  const port = await getFreePort();
  const child = childProcess.spawn(process.execPath, [SERVER_PATH, '--port', String(port)], {
    cwd: PPT_AGENT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  t.after(() => {
    if (!child.killed) child.kill();
  });
  await waitFor(async () => {
    try {
      const res = await request(port, 'GET', '/app.css');
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }, `server did not start. stderr:\n${stderr}`);
  return { port, request: (method, p, body, headers) => request(port, method, p, body, headers) };
}

function writeDeliverReadyRun(runId) {
  const dir = path.join(RUNS_ROOT, runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lesson-source.json'), JSON.stringify({
    title: 'Smoke',
    scripture_ref: 'John 1:1',
    material_name: 'Test',
    age_group: '3-5',
    core_points: ['safe'],
    raw_text: 'test',
    source_kind: 'text',
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'lesson-outline.json'), JSON.stringify({
    title: 'Smoke Lesson',
    scripture_ref: 'John 1:1',
    teaching: {
      scenes: [
        {
          index: 1,
          title: 'Scene One',
          narration: 'Narration',
          interaction: 'Question',
          image_brief: 'Image brief',
        },
      ],
    },
    memory_verse: { text: 'Verse', ref: 'John 1:1' },
  }, null, 2));
  return dir;
}

function waitForSseEvent(port, requestPath, predicate, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method: 'GET',
      path: requestPath,
      headers: { Accept: 'text/event-stream' },
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = { event: 'message', data: '' };
          for (const line of raw.split('\n')) {
            if (line.startsWith('event: ')) event.event = line.slice(7);
            else if (line.startsWith('data: ')) event.data += line.slice(6);
          }
          if (predicate(event)) {
            clearTimeout(timer);
            req.destroy();
            resolve(event);
          }
        }
      });
    });
    req.on('error', (err) => {
      if (err.code !== 'ECONNRESET') reject(err);
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Timed out waiting for SSE event on ${requestPath}`));
    }, timeoutMs);
    req.end();
  });
}

test('unsafe run ids do not resolve to the runs root directory', async (t) => {
  const app = await startServer(t);

  for (const unsafePath of ['/api/runs/%2e%2e', '/api/runs/%21%21%21']) {
    const res = await app.request('GET', unsafePath);
    assert.notStrictEqual(res.statusCode, 200, `${unsafePath} must not expose RUNS_ROOT as a run`);
  }
});

test('execute lock rejects a second request while the first body is still streaming', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('lock');
  const runDir = writeDeliverReadyRun(runId);
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const firstReq = http.request({
    hostname: '127.0.0.1',
    port: app.port,
    method: 'POST',
    path: `/api/runs/${runId}/execute/deliver`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '100000',
    },
  });
  firstReq.on('error', () => {});
  firstReq.flushHeaders();
  firstReq.write('{"slow":');
  t.after(() => firstReq.destroy());

  await delay(100);
  const second = await app.request('POST', `/api/runs/${runId}/execute/deliver`, '{}', {
    'Content-Type': 'application/json',
  });
  assert.strictEqual(second.statusCode, 409);
  assert.match(second.text, /already running/);
});

test('SSE stream replays terminal status when client connects after phase completion', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('sse');
  const runDir = writeDeliverReadyRun(runId);
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const started = await app.request('POST', `/api/runs/${runId}/execute/deliver`, '{}', {
    'Content-Type': 'application/json',
  });
  assert.strictEqual(started.statusCode, 200);

  await waitFor(
    () => fs.existsSync(path.join(runDir, 'output', 'speaker-notes.md')),
    'deliver phase did not write speaker-notes.md'
  );

  const event = await waitForSseEvent(
    app.port,
    `/api/runs/${runId}/execute/deliver/stream`,
    (evt) => evt.event === 'status' && JSON.parse(evt.data).status === 'done'
  );
  assert.strictEqual(JSON.parse(event.data).phase, 'deliver');
});

test('DELETE /api/runs/:id removes the entire run root directory recursively', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('delete');
  const runDir = writeDeliverReadyRun(runId);
  const nestedFile = path.join(runDir, 'nested', 'deep', 'artifact.txt');
  fs.mkdirSync(path.dirname(nestedFile), { recursive: true });
  fs.writeFileSync(nestedFile, 'delete me');
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const deleted = await app.request('DELETE', `/api/runs/${runId}`);

  assert.strictEqual(deleted.statusCode, 200);
  assert.deepStrictEqual(deleted.json, { ok: true, id: runId });
  assert.strictEqual(fs.existsSync(runDir), false, 'run root directory should be deleted');
});

test('DELETE /api/runs/:id rejects unsafe ids without touching the runs root', async (t) => {
  const app = await startServer(t);
  const before = fs.statSync(RUNS_ROOT).mtimeMs;

  const deleted = await app.request('DELETE', '/api/runs/%2e%2e');

  assert.strictEqual(deleted.statusCode, 404);
  assert.ok(fs.existsSync(RUNS_ROOT), 'runs root must still exist');
  assert.strictEqual(fs.statSync(RUNS_ROOT).mtimeMs, before);
});

test('DELETE /api/runs/:id refuses to delete a run while a phase is active', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('delete-active');
  const runDir = writeDeliverReadyRun(runId);
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const firstReq = http.request({
    hostname: '127.0.0.1',
    port: app.port,
    method: 'POST',
    path: `/api/runs/${runId}/execute/deliver`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '100000',
    },
  });
  firstReq.on('error', () => {});
  firstReq.flushHeaders();
  firstReq.write('{"slow":');
  t.after(() => firstReq.destroy());

  await delay(100);
  const deleted = await app.request('DELETE', `/api/runs/${runId}`);

  assert.strictEqual(deleted.statusCode, 409);
  assert.match(deleted.text, /already running/);
  assert.ok(fs.existsSync(runDir), 'run root should not be deleted while active');
});

test('POST /api/runs imports all images from a local folder without browser uploads', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('local-folder');
  const runDir = path.join(RUNS_ROOT, runId);
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-local-images-'));
  const nestedDir = path.join(sourceRoot, 'nested');
  fs.mkdirSync(nestedDir);
  fs.writeFileSync(path.join(sourceRoot, 'page-01.jpg'), 'jpg-one');
  fs.writeFileSync(path.join(sourceRoot, 'page-02.png'), 'png-two');
  fs.writeFileSync(path.join(nestedDir, 'page-03.jpeg'), 'jpeg-three');
  fs.writeFileSync(path.join(sourceRoot, 'notes.txt'), 'not an image');
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const created = await app.request('POST', '/api/runs', JSON.stringify({
    id: runId,
    imageFolderPath: sourceRoot,
  }), { 'Content-Type': 'application/json' });

  assert.strictEqual(created.statusCode, 200);
  assert.strictEqual(created.json.ok, true);
  assert.strictEqual(created.json.id, runId);
  assert.strictEqual(created.json.imageCount, 3);
  assert.deepStrictEqual(created.json.images, ['page-01.jpg', 'page-02.png', 'page-03.jpeg']);
  assert.strictEqual(created.text.includes(sourceRoot), false);
  assert.strictEqual(fs.readFileSync(path.join(runDir, 'input-images', 'page-01.jpg'), 'utf8'), 'jpg-one');
  assert.strictEqual(fs.readFileSync(path.join(runDir, 'input-images', 'page-02.png'), 'utf8'), 'png-two');
  assert.strictEqual(fs.readFileSync(path.join(runDir, 'input-images', 'page-03.jpeg'), 'utf8'), 'jpeg-three');
  assert.strictEqual(fs.existsSync(path.join(runDir, 'input-images', 'notes.txt')), false);
});

test('POST /api/runs rejects a missing local image folder without creating a run', async (t) => {
  const app = await startServer(t);
  const runId = uniqueRunId('missing-folder');
  const runDir = path.join(RUNS_ROOT, runId);
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));

  const created = await app.request('POST', '/api/runs', JSON.stringify({
    id: runId,
    imageFolderPath: path.join(os.tmpdir(), `missing-${Date.now()}`),
  }), { 'Content-Type': 'application/json' });

  assert.strictEqual(created.statusCode, 400);
  assert.match(created.json.error, /local image folder/i);
  assert.strictEqual(fs.existsSync(runDir), false);
});

test('new run page starts from a native folder picker without uploading browser files', () => {
  const html = fs.readFileSync(NEW_RUN_PAGE_PATH, 'utf8');

  assert.match(html, /\/api\/pick-folder/);
  assert.match(html, /imageFolderPath: selectedFolder\.path/);
  assert.match(html, /Imported \$\{run\.imageCount\} local image/);
  // No browser-upload fallback remains.
  assert.doesNotMatch(html, /webkitdirectory/);
  assert.doesNotMatch(html, /input-images\/\$\{name\}/);
});

test('run detail scene actions keep redo reason above approval buttons', () => {
  const html = fs.readFileSync(RUN_DETAIL_PAGE_PATH, 'utf8');

  assert.match(html, /\.scene-card \.actions\s*{[^}]*display:\s*grid/s);
  assert.match(html, /\.scene-card \.actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/s);
  assert.match(html, /\.scene-card \.actions textarea\s*{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(html, /<div class="action-buttons">/);
  assert.match(html, /<textarea id="reason-\$\{s\.nn\}"[^>]*rows="2"/);
});

test('dashboard delete uses an in-app confirmation instead of browser dialogs', () => {
  const html = fs.readFileSync(DASHBOARD_PAGE_PATH, 'utf8');

  assert.doesNotMatch(html, /window\.prompt/);
  assert.doesNotMatch(html, /window\.confirm/);
  assert.doesNotMatch(html, /\balert\(/);
  assert.doesNotMatch(html, /Type the run ID/i);
  assert.match(html, /data-run-title="\$\{attr\(displayTitle\)\}"/);
  assert.match(html, /id="deleteModal"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /function showToast/);
  assert.match(html, /function friendlyDeleteError/);
  assert.match(html, /async function runStillExists/);
  assert.match(html, /await friendlyDeleteError\(res\.status,body,title,id\)/);
  assert.match(html, /if\(await runStillExists\(id\)\)/);
});

test('GPT image understanding uses non-interactive codex exec without script pseudo-tty', () => {
  const source = fs.readFileSync(PHASES_PATH, 'utf8');

  assert.doesNotMatch(source, /spawn\('script'/);
  assert.doesNotMatch(source, /tcgetattr|ioctl/);
  assert.match(source, /spawn\('codex'/);
  assert.match(source, /'exec'/);
  assert.match(source, /'-i'/);
});
