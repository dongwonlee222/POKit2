#!/usr/bin/env node
import path from 'node:path';

import {
  adoptTaskSession,
  createTaskSession,
} from './lib/worktree-sessions.mjs';
import { decidePolicyAction } from './lib/push-policy.mjs';

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

const { command, args } = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);

try {
  let result;
  if (command === 'create-task') {
    result = await createTaskSession(root, {
      project: args.project ?? 'pokit',
      issueId: args.issue,
      engine: args.engine ?? 'unknown',
      sessionId: args.session,
      worktreeRoot: args['worktree-root'],
      holder: args.holder,
      reason: args.reason,
    });
  } else if (command === 'adopt-task') {
    result = await adoptTaskSession(root, {
      project: args.project ?? 'pokit',
      issueId: args.issue,
      engine: args.engine ?? 'unknown',
      sessionId: args.session,
      branch: args.branch,
      worktreePath: args.worktree,
      holder: args.holder,
      reason: args.reason,
    });
  } else if (command === 'assert-action') {
    result = decidePolicyAction({
      actor: args.actor ?? 'task_session',
      action: args.action,
      surface: args.surface ?? 'pokit-session assert-action',
      pushPolicy: args['push-policy'],
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.allowed ? 0 : 2);
  } else {
    console.error('Usage: pokit-session <create-task|adopt-task|assert-action> --issue POK-224 [options]');
    process.exit(1);
  }
  console.log(JSON.stringify({
    session: result.session,
    session_path: result.session_path,
    handoff: result.handoff,
  }, null, 2));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
