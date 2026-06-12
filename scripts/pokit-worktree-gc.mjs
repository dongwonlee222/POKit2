#!/usr/bin/env node
import path from 'node:path';

import {
  cleanupWorktreeGc,
  formatWorktreeGcJson,
  planWorktreeGc,
} from './lib/worktree-gc.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), dryRun: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      args.dryRun = false;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
    }
  }
  return args;
}

function buildOptions(args) {
  return {
    now: args.now ? new Date(args.now) : new Date(),
    retentionDays: args['retention-days'] ?? 14,
    currentSessionId: args['current-session'] ?? null,
    currentWorktreePath: args['current-worktree'] ?? process.cwd(),
  };
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);

try {
  const result = args.dryRun
    ? await planWorktreeGc(root, buildOptions(args))
    : await cleanupWorktreeGc(root, buildOptions(args));
  process.stdout.write(formatWorktreeGcJson(result));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
