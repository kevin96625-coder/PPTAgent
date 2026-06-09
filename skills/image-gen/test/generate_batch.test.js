// skills/image-gen/test/generate_batch.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { runBatch } = require('../scripts/generate_batch');

// 一个假的 generate.run：记录并发峰值，按 label 决定成功/失败
function makeFakeRun({ failLabels = [] } = {}) {
  let active = 0, peak = 0;
  const calls = [];
  async function fakeRun(args) {
    calls.push(args.label);
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--;
    if (failLabels.includes(args.label)) {
      throw new Error(`boom:${args.label}`);
    }
    return { imagePath: `${args.out}`, meta: { backend: 'fake' } };
  }
  return { fakeRun, calls, getPeak: () => peak };
}

test('runBatch 同时跑多个 job 且尊重并发上限', async () => {
  const jobs = Array.from({ length: 6 }, (_, i) => ({
    runDir: '/rd', label: `scene-0${i + 1}`, out: `/rd/images/scene-0${i + 1}.png`, prompt: 'x',
  }));
  const { fakeRun, getPeak } = makeFakeRun();
  const results = await runBatch(jobs, { concurrency: 3, runFn: fakeRun });

  assert.strictEqual(results.length, 6);
  assert.ok(results.every((r) => r.ok === true), '全部成功');
  assert.ok(getPeak() <= 3, `并发峰值应 <=3，实际 ${getPeak()}`);
  assert.ok(getPeak() >= 2, '应确实并发（>=2）');
});

test('runBatch 单个失败不影响其它，结果顺序与输入一致', async () => {
  const jobs = [
    { runDir: '/rd', label: 'scene-01', out: '/a.png', prompt: 'x' },
    { runDir: '/rd', label: 'scene-02', out: '/b.png', prompt: 'x' },
    { runDir: '/rd', label: 'scene-03', out: '/c.png', prompt: 'x' },
  ];
  const { fakeRun } = makeFakeRun({ failLabels: ['scene-02'] });
  const results = await runBatch(jobs, { concurrency: 2, runFn: fakeRun });

  assert.deepStrictEqual(results.map((r) => r.label), ['scene-01', 'scene-02', 'scene-03']);
  assert.strictEqual(results[0].ok, true);
  assert.strictEqual(results[1].ok, false);
  assert.match(results[1].error, /boom:scene-02/);
  assert.strictEqual(results[2].ok, true);
});
