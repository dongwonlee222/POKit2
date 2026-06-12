#!/usr/bin/env node
import { ISSUE_ID_PATTERN, planFanOut } from './lib/claude-provider-adapter.mjs';

const args = process.argv.slice(2);
const issueId = args[0];

function readFlag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

if (!issueId || !ISSUE_ID_PATTERN.test(issueId)) {
  process.stderr.write('error: claude provider adapter requires POK-### issue id\n');
  process.exit(1);
}

const runtimePreference = readFlag('--runtime-preference') ?? 'claude';

try {
  const result = planFanOut([], { runtimePreference });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exit(1);
}
