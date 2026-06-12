#!/usr/bin/env node
import path from 'node:path';

import {
  acquireIssueLock,
  acquireStateWriteGuard,
  listLocks,
  releaseLock,
} from './lib/worktree-locks.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), force: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'force') args.force = true;
      else args[key] = argv[++index];
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0], args };
}

function printLock(lock) {
  console.log(`${lock.kind} ${lock.resource} holder=${lock.holder} lifecycle=${lock.lifecycle}`);
}

const { command, args } = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);

try {
  if (command === 'acquire-issue') {
    const result = await acquireIssueLock(root, {
      issueId: args.issue,
      holder: args.holder,
      reason: args.reason,
      force: args.force,
    });
    if (!result.acquired) {
      console.error(result.message);
      process.exit(2);
    }
    console.log(`${result.takeover ? 'takeover' : 'acquired'} issue ${result.lock.issue_id}`);
  } else if (command === 'acquire-state') {
    const result = await acquireStateWriteGuard(root, {
      filePath: args.file,
      holder: args.holder,
      reason: args.reason,
      force: args.force,
    });
    if (!result.acquired) {
      console.error(result.message);
      process.exit(2);
    }
    console.log(`${result.takeover ? 'takeover' : 'acquired'} state ${result.lock.resource}`);
  } else if (command === 'release') {
    const result = await releaseLock(root, {
      kind: args.kind,
      resource: args.resource,
      holder: args.holder,
      force: args.force,
    });
    console.log(`released ${result.lock.kind === 'issue' ? 'issue' : 'state'} ${result.lock.resource}`);
  } else if (command === 'list') {
    const locks = await listLocks(root);
    if (locks.length === 0) {
      console.log('No locks');
    } else {
      for (const lock of locks) printLock(lock);
    }
  } else {
    console.error('Usage: pokit-lock <acquire-issue|acquire-state|release|list> [options]');
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
