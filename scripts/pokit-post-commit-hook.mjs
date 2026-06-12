#!/usr/bin/env node
import { runPostCommitHook } from './lib/after-gate-pass-natural-hook.mjs';

const result = await runPostCommitHook({ root: process.cwd() });
if (result.emitted) {
  process.stdout.write(`after_gate_pass emitted for ${result.issueId}\n`);
}
