#!/usr/bin/env node
import { readProjectOverview, renderProjectOverview } from './lib/project-overview.mjs';

function parseArgs(argv) {
  const args = { homeDir: undefined, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === 'overview') continue;
    if (arg === '--home') args.homeDir = argv[++index];
    else if (arg === '--json') args.json = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const overview = await readProjectOverview({ homeDir: args.homeDir });
console.log(args.json ? JSON.stringify(overview, null, 2) : renderProjectOverview(overview));
