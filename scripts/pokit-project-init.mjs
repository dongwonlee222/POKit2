#!/usr/bin/env node
import path from 'node:path';

import { createProject, recommendProjectIdentity } from './lib/project-state.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), yes: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') args.root = argv[++index];
    else if (arg === '--key') args.key = argv[++index];
    else if (arg === '--name') args.name = argv[++index];
    else if (arg === '--prefix') args.prefix = argv[++index];
    else if (arg === '--yes') args.yes = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const recommended = recommendProjectIdentity(root);
const project = {
  key: args.key ?? recommended.key,
  name: args.name ?? recommended.name,
  prefix: args.prefix ?? recommended.prefix,
};

// POK-251: preview (no --yes) must be read-only. ensureProjectState writes local
// .pokit state AND registers the project in the global ~/.pokit registry, so calling
// it before the --yes gate leaks a durable write on a confirm-only run ("승인 전 durable 금지").
// Only the --yes path creates state; createProject calls ensureProjectState internally.
if (!args.yes) {
  console.log(JSON.stringify({ action: 'confirm_project_creation', project }, null, 2));
} else {
  const result = await createProject(root, project);
  console.log(JSON.stringify({ action: 'project_created', project: result.project }, null, 2));
}
