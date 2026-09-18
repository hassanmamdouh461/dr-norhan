'use strict';
// Run installed local tooling only. No installs, deployment, or live API access.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'outputs', 'validation');
fs.mkdirSync(output, { recursive: true });
const node = process.execPath;
const results = [];
const local = (app, file) => path.join(root, app, file);
function run(id, app, args) {
  return new Promise(resolve => {
    const start = Date.now();
    const log = path.join(output, `${id}.txt`);
    const stream = fs.createWriteStream(log);
    let text = '';
    const child = spawn(node, args, {
      cwd: path.join(root, app),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CI: '1', NO_COLOR: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const collect = data => { const part = data.toString(); text += part; stream.write(part); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', error => collect(String(error)));
    child.on('close', (code, signal) => {
      stream.end();
      const clean = text.replace(/\u001b\[[0-9;]*m/g, '');
      const vitest = clean.match(/Tests\s+(\d+) passed/);
      const tap = clean.match(/^# pass (\d+)$/m);
      const result = { id, cwd: app, exitCode: code, signal, status: code === 0 ? 'passed' : 'failed', passedTests: Number(vitest?.[1] || tap?.[1] || 0), durationSeconds: +((Date.now() - start) / 1000).toFixed(2), log: path.relative(root, log).replaceAll('\\', '/'), command: [node, ...args] };
      results.push(result);
      console.log(`${result.status.toUpperCase()} ${id}${result.passedTests ? `: ${result.passedTests} tests` : ''}`);
      resolve(result);
    });
  });
}
(async () => {
  await Promise.all([
    run('backend-types', 'backend', [local('backend', 'node_modules/typescript/bin/tsc'), '--project', local('backend', 'tsconfig.json'), '--noEmit', '--incremental', 'false']),
    run('dashboard-types', 'dashboard', [local('dashboard', 'node_modules/typescript/bin/tsc'), '--project', local('dashboard', 'tsconfig.json'), '--noEmit', '--incremental', 'false']),
    run('student-web-types', 'student-web', [local('student-web', 'node_modules/typescript/bin/tsc'), '--project', local('student-web', 'tsconfig.app.json'), '--noEmit', '--incremental', 'false']),
  ]);
  await Promise.all([
    run('backend-tests', 'backend', [local('backend', 'node_modules/vitest/vitest.mjs'), 'run', '--root', local('backend', ''), '--config', local('backend', 'vitest.config.ts'), '--pool=forks', '--maxWorkers=1', '--minWorkers=1', '--no-cache']),
    run('dashboard-regressions', 'dashboard', ['--test', local('dashboard', 'src/app/dashboard/exams/exam-selection-regression.test.cjs'), local('dashboard', 'src/app/dashboard/questions/question-selection-regression.test.cjs')]),
    run('student-web-regressions', 'student-web', ['--test', local('student-web', 'src/pages/home/assessmentContract.test.mjs'), local('student-web', 'src/components/ui/Modal.accessibility.regression.test.mjs'), local('student-web', 'lesson-player-generation.worker-regression.cjs')]),
  ]);
  const builds = [run('student-web-build', 'student-web', [local('student-web', 'node_modules/vite/bin/vite.js'), 'build', '--outDir', path.join(root, 'outputs', 'build', `student-web-${Date.now()}`)])];
  // Normal Next builds clean existing outputs. Require an explicit opt-in after
  // the environment's cleanup confirmation is resolved; never disable guards.
  if (process.argv.includes('--dashboard-build')) {
    builds.push(run('dashboard-build', 'dashboard', [local('dashboard', 'node_modules/next/dist/bin/next'), 'build']));
  } else {
    const isolatedPath = path.join(output, 'dashboard-build-isolated.json');
    const isolated = fs.existsSync(isolatedPath) ? JSON.parse(fs.readFileSync(isolatedPath, 'utf8')) : null;
    results.push({ id: 'dashboard-build', status: isolated ? 'blocked-cleanup-confirmation' : 'not-run', passedTests: 0, compiledSuccessfully: isolated?.compiledSuccessfully ?? false, staticPagesGenerated: isolated?.staticPagesGenerated ?? 0, log: isolated ? 'outputs/validation/dashboard-build-isolated.txt' : null, detail: isolated?.blocker ?? 'Use --dashboard-build only after confirming build output cleanup.' });
  }
  await Promise.all(builds);
  const summary = { generatedAt: new Date().toISOString(), nodeVersion: process.version, results, passedTests: results.reduce((sum, item) => sum + item.passedTests, 0), limitations: ['Flutter and Dart were not available: mobile compilation, analysis, and 38 authored tests were not run.', 'Web regression harnesses are offline simulations, not browser or screen-reader tests.', 'No deployment or production database mutation was performed.'] };
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  process.exitCode = results.some(result => result.status !== 'passed') ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
