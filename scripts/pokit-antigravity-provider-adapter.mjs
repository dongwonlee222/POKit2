#!/usr/bin/env node
import { runAntigravityProviderAdapter } from './lib/antigravity-provider-adapter.mjs';

const args = process.argv.slice(2);
const issueId = args[0];

function readFlag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

if (!issueId) {
  process.stderr.write('error: antigravity provider adapter requires POK-### issue id\n');
  process.exit(1);
}

try {
  const result = await runAntigravityProviderAdapter({
    issueId,
    artifactPath: readFlag('--artifact-path') ?? undefined,
    runtimeProofPath: readFlag('--runtime-proof-path') ?? undefined,
    eventLogPath: readFlag('--event-log-path') ?? undefined,
    now: readFlag('--now') ?? undefined,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exit(1);
}
