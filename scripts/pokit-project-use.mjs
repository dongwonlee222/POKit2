#!/usr/bin/env node
import { parseArgs, readRegistry, updateCurrent } from './pokit-project-contract.mjs';

const args = parseArgs(process.argv.slice(2));
const key = args._?.[0] ?? args.key;
const root = process.cwd();

if (!key) {
  console.error('Usage: node scripts/pokit-project-use.mjs my-project');
  process.exit(1);
}

try {
  const registry = await readRegistry(root);
  const project = registry.projects.find((entry) => entry.key === key);
  if (!project) throw new Error(`Unknown project: ${key}`);
  await updateCurrent(root, {
    active_project: key,
    active_issue: null,
    gate_state: 'idle',
    next_action: `Create the first ${key} issue with node scripts/pokit-issue-create.mjs --title "..."`,
    updated_at: new Date().toISOString().slice(0, 10),
  });
  console.log(JSON.stringify({ status: 'pass', active_project: key, namespace: project.namespace }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
