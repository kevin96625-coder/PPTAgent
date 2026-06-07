const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');

// Minimal preset YAML object mirroring the real flat-cartoon.yaml structure
const FLAT_CARTOON_YAML = {
  name: 'Flat Cartoon',
  image_aspect: '4:3',
  identity_block_template:
    'Character: {character_name}\nHair: {hair_description}\nClothing: {clothing}\nArt style lock: flat rounded cartoon',
  style_block:
    'Art style: flat rounded 2D cartoon illustration\nLine work: bold black outlines',
};

const CHARACTER_DESC = {
  character_name: 'Jesus',
  age_appearance: 'early 30s',
  ethnicity: '1st-century Jewish Near Eastern',
  hair_description: 'brown shoulder-length wavy hair, short beard',
  clothing: 'beige/cream ankle-length robe, brown leather sandals',
  palette: 'warm beige, cream, brown, muted blue',
};

test('buildStyleLock fills identity_block_template placeholders', () => {
  const lock = buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: CHARACTER_DESC,
  });
  assert.strictEqual(lock.style_preset, 'flat-cartoon');
  assert.match(lock.identity_block, /Jesus/);
  assert.match(lock.identity_block, /brown shoulder-length wavy hair/);
  assert.match(lock.identity_block, /flat rounded cartoon/);
  assert.match(lock.style_block, /flat rounded 2D cartoon/);
  assert.strictEqual(lock.aspect, '4:3');
});

test('buildStyleLock leaves no unfilled {placeholder} tokens in identity_block', () => {
  const lock = buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: CHARACTER_DESC,
  });
  assert.doesNotMatch(lock.identity_block, /\{[a-z_]+\}/);
});

test('buildStyleLock throws when presetYaml missing style_block', () => {
  assert.throws(() => buildStyleLock({
    preset: 'x',
    presetYaml: { image_aspect: '4:3', identity_block_template: 'hi' },
    characterDesc: CHARACTER_DESC,
  }), /style_block/);
});

test('buildStyleLock throws when characterDesc missing required keys', () => {
  assert.throws(() => buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: {},
  }), /characterDesc/);
});

test('writeStyleLock creates style.lock.json, style.lock.identity.txt, style.lock.style.txt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  const paths = writeStyleLock(dir, lock);

  const jsonPath = path.join(dir, 'style.lock.json');
  const idPath = path.join(dir, 'style.lock.identity.txt');
  const stylePath = path.join(dir, 'style.lock.style.txt');

  assert.ok(fs.existsSync(jsonPath), 'style.lock.json must exist');
  assert.ok(fs.existsSync(idPath), 'style.lock.identity.txt must exist');
  assert.ok(fs.existsSync(stylePath), 'style.lock.style.txt must exist');

  assert.deepStrictEqual(paths, { jsonPath, idPath, stylePath });
});

test('writeStyleLock style.lock.json contains all required keys with correct values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  writeStyleLock(dir, lock);

  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'style.lock.json'), 'utf8'));
  assert.strictEqual(onDisk.style_preset, 'flat-cartoon');
  assert.ok(typeof onDisk.identity_block === 'string' && onDisk.identity_block.length > 0);
  assert.ok(typeof onDisk.style_block === 'string' && onDisk.style_block.length > 0);
  assert.strictEqual(onDisk.aspect, '4:3');
  // master_reference is not set by writeStyleLock (set later by the agent after master generation)
  assert.ok(!('master_reference' in onDisk) || onDisk.master_reference === null);
});

test('writeStyleLock identity.txt content matches lock.identity_block', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  writeStyleLock(dir, lock);

  const idTxt = fs.readFileSync(path.join(dir, 'style.lock.identity.txt'), 'utf8');
  assert.strictEqual(idTxt.trim(), lock.identity_block.trim());
});
