const test = require('node:test');
const assert = require('node:assert');
const { buildGenerateArgs } = require('../lib/scene_plan');

const BASE = {
  runDir: '/rd/run1',
  label: 'scene-03',
  outPath: '/rd/run1/images/scene-03.png',
  briefFile: '/rd/run1/briefs/scene-03.txt',
  identityFile: '/rd/run1/style.lock.identity.txt',
  styleFile: '/rd/run1/style.lock.style.txt',
};

test('buildGenerateArgs returns an array of strings with all required flags', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  assert.ok(Array.isArray(args), 'must return an array');
  assert.ok(args.every((a) => typeof a === 'string'), 'all elements must be strings');
});

test('buildGenerateArgs includes --run-dir, --label, --out', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--run-dir \/rd\/run1/);
  assert.match(joined, /--label scene-03/);
  assert.match(joined, /--out \/rd\/run1\/images\/scene-03\.png/);
});

test('buildGenerateArgs includes --prompt-file, --identity-file, --style-file', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--prompt-file \/rd\/run1\/briefs\/scene-03\.txt/);
  assert.match(joined, /--identity-file \/rd\/run1\/style\.lock\.identity\.txt/);
  assert.match(joined, /--style-file \/rd\/run1\/style\.lock\.style\.txt/);
});

test('buildGenerateArgs includes --reference for scene images when reference is provided', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--reference \/rd\/run1\/master\/master-reference\.png/);
});

test('buildGenerateArgs OMITS --reference when reference is not provided (master generation)', () => {
  const masterArgs = buildGenerateArgs({
    runDir: '/rd/run1',
    label: 'master',
    outPath: '/rd/run1/master/master-reference.png',
    briefFile: '/rd/run1/briefs/master.txt',
    identityFile: '/rd/run1/style.lock.identity.txt',
    styleFile: '/rd/run1/style.lock.style.txt',
    // no reference
  });
  assert.ok(!masterArgs.includes('--reference'), '--reference must be absent for master generation');
  assert.match(masterArgs.join(' '), /--label master/);
});

test('buildGenerateArgs includes --redo when redo=true', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png', redo: true });
  assert.ok(args.includes('--redo'), '--redo must be present when redo=true');
});

test('buildGenerateArgs OMITS --redo when redo=false or absent', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png', redo: false });
  assert.ok(!args.includes('--redo'), '--redo must be absent when redo=false');

  const args2 = buildGenerateArgs({ ...BASE, reference: '/m.png' });
  assert.ok(!args2.includes('--redo'), '--redo must be absent when redo not specified');
});

test('buildGenerateArgs consecutive flag/value pairs are correctly paired', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png' });
  // Check that --run-dir is immediately followed by its value
  const rdIdx = args.indexOf('--run-dir');
  assert.ok(rdIdx >= 0, '--run-dir must be in args');
  assert.strictEqual(args[rdIdx + 1], '/rd/run1');

  const labelIdx = args.indexOf('--label');
  assert.ok(labelIdx >= 0, '--label must be in args');
  assert.strictEqual(args[labelIdx + 1], 'scene-03');
});

test('buildGenerateArgs throws when required fields missing', () => {
  assert.throws(() => buildGenerateArgs({ label: 'x', outPath: '/o.png', briefFile: '/b.txt', identityFile: '/i.txt', styleFile: '/s.txt' }), /runDir/);
  assert.throws(() => buildGenerateArgs({ runDir: '/r', outPath: '/o.png', briefFile: '/b.txt', identityFile: '/i.txt', styleFile: '/s.txt' }), /label/);
});
