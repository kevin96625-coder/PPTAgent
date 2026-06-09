// skills/image-gen/scripts/generate_batch.js
'use strict';
const fs = require('node:fs');
const { run } = require('./generate');

/**
 * 以固定并发上限运行一批生成 job。单个失败不影响整批。
 * @param {Array<object>} jobs  每项是 generate.run 的 args（含 label/out/prompt 或 promptFile 等）
 * @param {{concurrency?:number, runFn?:Function, deps?:object}} opts
 * @returns {Promise<Array<{label:string, ok:boolean, out?:string, error?:string}>>}
 *          顺序与 jobs 一致
 */
async function runBatch(jobs, opts = {}) {
  const concurrency = Math.max(1, opts.concurrency || 3);
  const runFn = opts.runFn || run;
  const deps = opts.deps || {};
  const results = new Array(jobs.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      const job = jobs[i];
      try {
        const res = await runFn(job, deps);
        results[i] = { label: job.label, ok: true, out: res.imagePath || job.out };
      } catch (err) {
        results[i] = { label: job.label, ok: false, error: String(err && err.message || err) };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseArgs(argv) {
  // --jobs-file <path>  指向一个 JSON 数组，每项是 generate.run 的 args
  // --concurrency <n>
  const a = { jobsFile: null, concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--jobs-file') { a.jobsFile = argv[++i]; }
    else if (argv[i] === '--concurrency') { a.concurrency = Number(argv[++i]) || 3; }
  }
  return a;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.jobsFile) {
    console.error('Usage: node generate_batch.js --jobs-file <jobs.json> [--concurrency 3]');
    process.exit(1);
  }
  const jobs = JSON.parse(fs.readFileSync(args.jobsFile, 'utf8'));
  runBatch(jobs, { concurrency: args.concurrency })
    .then((results) => {
      const failed = results.filter((r) => !r.ok);
      console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
      process.exit(failed.length > 0 ? 2 : 0);
    })
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { runBatch, parseArgs };
