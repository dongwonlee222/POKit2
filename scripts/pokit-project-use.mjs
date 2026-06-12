#!/usr/bin/env node
import path from 'node:path';

import { switchProject } from './lib/project-state.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') args.root = argv[++index];
    else if (arg === '--project') args.project = argv[++index];
    else if (arg === '--force') args.force = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) {
  console.error('Error: --project is required');
  process.exit(1);
}

try {
  const result = await switchProject(path.resolve(args.root), args.project, { force: args.force });
  console.log(`Current project: ${result.activeProject.key} (${result.activeProject.prefix})`);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
