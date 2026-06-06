const test = require('node:test');
const assert = require('node:assert');
const { assembleFullPrompt } = require('../scripts/lib/prompt');

test('concatenates scene, identity, style with fixed headers in order', () => {
  const out = assembleFullPrompt({
    sceneBrief: 'Jesus calms the storm on the boat',
    identityBlock: 'Jesus: gentle face, brown shoulder-length hair, beige robe',
    styleBlock: 'flat rounded cartoon, bright colors, simple background',
  });
  assert.match(out, /\[CHARACTER\][\s\S]*brown shoulder-length hair/);
  assert.match(out, /\[STYLE\][\s\S]*flat rounded cartoon/);
  assert.match(out, /\[SCENE\][\s\S]*calms the storm/);
  // CHARACTER and STYLE must precede SCENE so identity/style anchor the generation
  assert.ok(out.indexOf('[CHARACTER]') < out.indexOf('[SCENE]'));
  assert.ok(out.indexOf('[STYLE]') < out.indexOf('[SCENE]'));
});

test('omits empty blocks but always keeps SCENE', () => {
  const out = assembleFullPrompt({ sceneBrief: 'A lone lamp' });
  assert.doesNotMatch(out, /\[CHARACTER\]/);
  assert.doesNotMatch(out, /\[STYLE\]/);
  assert.match(out, /\[SCENE\][\s\S]*lone lamp/);
});

test('throws when sceneBrief missing', () => {
  assert.throws(() => assembleFullPrompt({}), /sceneBrief/);
});
