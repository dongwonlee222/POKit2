#!/usr/bin/env node
import {
  ensureProjectFolders,
  parseArgs,
  readRegistry,
  syncStarterStateViews,
  validateNamespace,
  validateProjectKey,
  writeRegistry,
} from './pokit-project-contract.mjs';

const args = parseArgs(process.argv.slice(2));
const key = args.key;
const name = args.name ?? key;
const namespace = args.namespace;
const root = process.cwd();

if (!key || !namespace) {
  console.error('Usage: node scripts/pokit-project-create.mjs --key my-project --name "My Project" --namespace MYP');
  process.exit(1);
}

try {
  validateProjectKey(key);
  validateNamespace(namespace);
  const registry = await readRegistry(root);
  if (registry.projects.some((project) => project.key === key)) throw new Error(`Project already exists: ${key}`);
  if (registry.projects.some((project) => project.namespace === namespace)) throw new Error(`Namespace already exists: ${namespace}`);
  registry.projects.push({ key, name, namespace, next_number: 1 });
  await ensureProjectFolders(root, key);
  await writeRegistry(root, registry);
  await syncStarterStateViews(root);
  console.log(JSON.stringify({ status: 'pass', project: key, namespace }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
