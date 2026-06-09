'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composeStorybookHtml } = require('../lib/html_compose');

function tmpRun() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-compose-'));
  fs.mkdirSync(path.join(dir, 'images'));
  // write a dummy image so path refs are checkable
  fs.writeFileSync(path.join(dir, 'images', 'scene-01.png'), 'PNG');
  fs.writeFileSync(path.join(dir, 'images', 'scene-02.png'), 'PNG');
  return dir;
}

const minimalOutline = {
  title: '主日学：耶稣洗门徒的脚',
  scripture_ref: '约翰福音 13:1-17',
  teaching: {
    scenes: [
      { index: 1, title: '晚餐前', key_message: '耶稣谦卑服事', narration: '门徒们坐下来吃晚饭。', interaction: '你会为朋友做什么？', image_brief: 'Last supper table' },
      { index: 2, title: '洗脚', key_message: '谦卑的榜样', narration: '耶稣弯腰洗门徒的脚。', interaction: '这让你感到惊讶吗？', image_brief: 'Jesus washing feet' },
    ],
  },
  memory_verse: { text: '你们也当彼此洗脚。', ref: '约翰福音 13:14' },
};

test('writes cover slide as slide-00.html with data-preset=designed', () => {
  const dir = tmpRun();
  const files = composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const coverPath = path.join(dir, 'slides', 'slide-00.html');
  assert.ok(fs.existsSync(coverPath), 'slide-00.html must exist');
  const html = fs.readFileSync(coverPath, 'utf8');
  assert.match(html, /data-preset="designed"/);
  assert.match(html, /data-slide-type="cover"/);
  assert.match(html, /主日学：耶稣洗门徒的脚/);
  assert.match(html, /约翰福音 13:1-17/);
  assert.ok(files.includes(coverPath));
});

test('writes one scene slide per scene, numbered 01..NN', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const s1 = fs.readFileSync(path.join(dir, 'slides', 'slide-01.html'), 'utf8');
  const s2 = fs.readFileSync(path.join(dir, 'slides', 'slide-02.html'), 'utf8');
  assert.match(s1, /data-slide-type="scene"/);
  assert.match(s1, /晚餐前/);
  assert.match(s1, /门徒们坐下来吃晚饭/);
  assert.match(s1, /storybook-image/);
  assert.match(s1, /\.\.\/images\/scene-01\.png/);
  assert.match(s2, /洗脚/);
  assert.match(s2, /\.\.\/images\/scene-02\.png/);
});

test('includes interaction text in caption-body', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const html = fs.readFileSync(path.join(dir, 'slides', 'slide-01.html'), 'utf8');
  assert.match(html, /你会为朋友做什么？/);
});

test('writes memory-verse slide when memory_verse present', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const mv = fs.readFileSync(path.join(dir, 'slides', 'slide-03.html'), 'utf8');
  assert.match(mv, /data-slide-type="memory-verse"/);
  assert.match(mv, /你们也当彼此洗脚/);
  assert.match(mv, /约翰福音 13:14/);
});

test('skips memory-verse slide when memory_verse absent', () => {
  const dir = tmpRun();
  const outline2 = { ...minimalOutline, memory_verse: null };
  const files = composeStorybookHtml({ outline: outline2, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  // only cover + 2 scenes = 3 files
  assert.strictEqual(files.length, 3);
});

test('returns sorted absolute paths of all written slides', () => {
  const dir = tmpRun();
  const files = composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  // cover + 2 scenes + memory verse = 4
  assert.strictEqual(files.length, 4);
  assert.ok(files[0].endsWith('slide-00.html'));
  assert.ok(files[files.length - 1].endsWith('slide-03.html'));
});

test('throws when outline.teaching.scenes is empty or missing', () => {
  const dir = tmpRun();
  assert.throws(
    () => composeStorybookHtml({ outline: { title: 'x', teaching: { scenes: [] } }, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') }),
    /scenes/
  );
});

test('memory-verse slide uses max scene index + 1 (no collision with non-contiguous indices)', () => {
  const dir = tmpRun();
  // scenes indexed 1 and 4 (non-contiguous): memory verse must be slide-05, not slide-03
  const outline = {
    title: '测试', scripture_ref: 'X 1:1',
    teaching: { scenes: [
      { index: 1, title: 'A', narration: 'a', interaction: 'qa', image_brief: 'b1' },
      { index: 4, title: 'B', narration: 'b', interaction: 'qb', image_brief: 'b2' },
    ] },
    memory_verse: { text: '金句', ref: 'X 1:2' },
  };
  composeStorybookHtml({ outline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const slidesDir = path.join(dir, 'slides');
  // scene 4 file must survive and still hold scene B, memory verse goes to slide-05
  assert.ok(fs.existsSync(path.join(slidesDir, 'slide-04.html')), 'scene-04 slide must exist');
  assert.match(fs.readFileSync(path.join(slidesDir, 'slide-04.html'), 'utf8'), /data-slide-type="scene"/);
  assert.ok(fs.existsSync(path.join(slidesDir, 'slide-05.html')), 'memory-verse must be slide-05');
  assert.match(fs.readFileSync(path.join(slidesDir, 'slide-05.html'), 'utf8'), /data-slide-type="memory-verse"/);
});

// --- designed preset tests ---
const { renderSlideHtml } = require('../lib/html_compose');

test('renderSlideHtml 默认输出 designed preset + 要点 + 经文', () => {
  const html = renderSlideHtml({ type: 'scene', title: '海水分开了', body: '天父刮起大风。', subtext: '一起喊：过红海！', scripture: '出埃及记 14', points: ['天父刮大风', '海水成墙'] });
  assert.match(html, /data-preset="designed"/);
  assert.match(html, /data-scripture="出埃及记 14"/);
  assert.match(html, /<ul class="caption-points">/);
  assert.match(html, /<li>天父刮大风<\/li>/);
});

test('composeStorybookHtml 把 scene.key_points 写进 designed HTML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
  const imagesDir = path.join(dir, 'images');
  const slidesDir = path.join(dir, 'slides');
  fs.mkdirSync(imagesDir, { recursive: true });
  const outline = {
    title: '红海分开了', scripture_ref: '出埃及记 14',
    teaching: { scenes: [
      { index: 1, title: '辛苦做苦工', key_message: '以色列人做苦工', narration: '每天搬砖头。', interaction: '累不累呀？', key_points: ['搬重砖头', '做得慢会挨打'] },
    ] },
  };
  const written = composeStorybookHtml({ outline, imagesDir, slidesDir });
  const sceneHtml = fs.readFileSync(written.find((p) => p.endsWith('slide-01.html')), 'utf8');
  assert.match(sceneHtml, /data-preset="designed"/);
  assert.match(sceneHtml, /<li>搬重砖头<\/li>/);
  assert.match(sceneHtml, /data-scripture="出埃及记 14"/);
});

test('缺 key_points 时回退到 key_message，不报错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
  const imagesDir = path.join(dir, 'images');
  const slidesDir = path.join(dir, 'slides');
  fs.mkdirSync(imagesDir, { recursive: true });
  const outline = { title: 'x', scripture_ref: 'y', teaching: { scenes: [
    { index: 1, title: 't', key_message: '关键句', narration: 'n', interaction: 'i' },
  ] } };
  const written = composeStorybookHtml({ outline, imagesDir, slidesDir });
  const sceneHtml = fs.readFileSync(written.find((p) => p.endsWith('slide-01.html')), 'utf8');
  assert.match(sceneHtml, /<li>关键句<\/li>/);
});
