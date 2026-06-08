const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findChrome, buildRenderArgs, stageImages } = require('../scripts/lib/render-svg');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'render-svg-test-'));
}

test('buildRenderArgs produces headless screenshot args at 1280x720', () => {
  const args = buildRenderArgs('/in/slide.svg', '/out/slide.png');
  assert.ok(args.includes('--headless'));
  assert.ok(args.some((a) => a.startsWith('--screenshot=')));
  assert.ok(args.includes('--window-size=1280,720'));
  assert.ok(args.some((a) => a.startsWith('file://') && a.endsWith('slide.svg')));
});

test('buildRenderArgs screenshot path matches out', () => {
  const args = buildRenderArgs('/in/a.svg', '/out/a.png');
  assert.ok(args.includes('--screenshot=/out/a.png'));
});

test('findChrome returns a string path or null (no throw)', () => {
  const c = findChrome();
  assert.ok(c === null || typeof c === 'string');
});

test('stageImages symlinks root/slides/images -> ../images so href resolves', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, 'images'));
    fs.writeFileSync(path.join(root, 'images', 'x.jpg'), 'JPGDATA');
    fs.mkdirSync(path.join(root, 'slides'));
    const svg = path.join(root, 'slides', 's.svg');
    fs.writeFileSync(svg, '<svg><image href="images/x.jpg"/></svg>');

    const ok = stageImages(svg);
    assert.strictEqual(ok, true);
    const staged = path.join(root, 'slides', 'images', 'x.jpg');
    assert.ok(fs.existsSync(staged), 'staged images/x.jpg should resolve to real file');
    assert.strictEqual(fs.readFileSync(staged, 'utf8'), 'JPGDATA');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stageImages is idempotent on second call (no throw)', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, 'images'));
    fs.writeFileSync(path.join(root, 'images', 'x.jpg'), 'JPGDATA');
    fs.mkdirSync(path.join(root, 'slides'));
    const svg = path.join(root, 'slides', 's.svg');
    fs.writeFileSync(svg, '<svg/>');

    assert.strictEqual(stageImages(svg), true);
    assert.strictEqual(stageImages(svg), true); // second call must not throw
    assert.ok(fs.existsSync(path.join(root, 'slides', 'images', 'x.jpg')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stageImages returns false when no parent images dir (no throw)', () => {
  const root = mkTmp();
  try {
    fs.mkdirSync(path.join(root, 'slides'));
    const svg = path.join(root, 'slides', 's.svg');
    fs.writeFileSync(svg, '<svg/>');

    assert.strictEqual(stageImages(svg), false);
    assert.ok(!fs.existsSync(path.join(root, 'slides', 'images')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
