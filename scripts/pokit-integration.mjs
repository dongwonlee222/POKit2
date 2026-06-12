#!/usr/bin/env node
import path from 'node:path';

import {
  decideProposedUpdate,
  listProposedUpdates,
  readProposedUpdate,
  writeProposedUpdate,
} from './lib/proposed-updates.mjs';
import { assertPolicyAction, decidePolicyAction, PolicyDeniedError } from './lib/push-policy.mjs';

function parseArgs(argv) {
  const positional = [];
  const args = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0], args };
}

function splitList(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

const { command, args } = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);

try {
  let result;
  if (command === 'propose') {
    result = await writeProposedUpdate(root, {
      issueId: args.issue,
      sessionId: args.session,
      engine: args.engine ?? 'unknown',
      changedPaths: splitList(args.paths),
      diffSummary: args.summary,
      verificationEvidence: splitList(args.verification),
      risks: splitList(args.risks ?? 'none recorded'),
      mainDecisionNeeded: args.decision ?? 'accept',
    });
  } else if (command === 'list') {
    result = await listProposedUpdates(root, { issueId: args.issue });
  } else if (command === 'read') {
    result = await readProposedUpdate(root, { issueId: args.issue, sessionId: args.session });
  } else if (command === 'decide') {
    assertPolicyAction({
      actor: args.actor ?? 'integration_session',
      action: 'state_write',
      surface: 'pokit-integration decide',
    });
    if (args.decision === 'accept') {
      assertPolicyAction({
        actor: args.actor ?? 'integration_session',
        action: 'commit',
        surface: 'pokit-integration decide',
      });
    }
    result = await decideProposedUpdate(root, {
      issueId: args.issue,
      sessionId: args.session,
      decision: args.decision,
      decidedBy: args['decided-by'] ?? 'integration-session',
      reason: args.reason,
    });
  } else if (command === 'policy-check') {
    result = decidePolicyAction({
      actor: args.actor ?? 'integration_session',
      action: args.action,
      surface: args.surface ?? 'pokit-integration policy-check',
      pushPolicy: args['push-policy'],
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.allowed ? 0 : 2);
  } else {
    console.error('Usage: pokit-integration <propose|list|read|decide|policy-check> --issue POK-224 [options]');
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  if (err instanceof PolicyDeniedError) {
    console.log(JSON.stringify(err.decision, null, 2));
    process.exit(2);
  }
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
