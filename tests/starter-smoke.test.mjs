import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('starter runner, doctor, metrics, issue list, and evidence list run', () => {
  for (const args of [
    ['scripts/pokit-runner.mjs', '$pokit'],
    ['scripts/pokit-doctor.mjs'],
    ['scripts/pokit-measure-startup.mjs'],
    ['scripts/pokit-list-issues.mjs'],
    ['scripts/pokit-list-evidence.mjs'],
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: process.env.HOME,
        CODEX_HOME: process.env.CODEX_HOME,
      },
    });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
  }
});
