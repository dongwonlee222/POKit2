#!/usr/bin/env node
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  findIssue,
  formatIssueId,
  getActiveProject,
  ISSUE_ID_PATTERN,
  issuePathForProject,
  parseArgs,
  readRegistry,
  updateCurrent,
  writeRegistry,
} from './pokit-project-contract.mjs';

const args = parseArgs(process.argv.slice(2));

if (!args.title) {
  console.error('Usage: node scripts/pokit-issue-create.mjs --title "First issue" [--project common] [--id COM-001] [--type implementation]');
  process.exit(1);
}

const root = process.cwd();
const createdAt = args['created-at'] ?? args.createdAt ?? new Date().toISOString().slice(0, 10);
const issueType = args.type ?? 'implementation';
const project = args.project
  ? (await readRegistry(root)).projects.find((entry) => entry.key === args.project)
  : await getActiveProject(root);

if (!project) {
  console.error(`Unknown project: ${args.project}`);
  process.exit(1);
}

const issueId = args.id ?? formatIssueId(project.namespace, project.next_number);
if (!ISSUE_ID_PATTERN.test(issueId)) {
  console.error(`Invalid issue id: ${issueId}`);
  process.exit(1);
}
if (!issueId.startsWith(`${project.namespace}-`)) {
  console.error(`Issue id ${issueId} does not match project namespace ${project.namespace}`);
  process.exit(1);
}
if (await findIssue(root, issueId)) {
  console.error(`Issue already exists: ${issueId}`);
  process.exit(1);
}
const issuePath = issuePathForProject(root, project.key, issueId);

try {
  await stat(issuePath);
  throw new Error(`Issue already exists: ${path.relative(root, issuePath)}`);
} catch (error) {
  if (error?.code !== 'ENOENT') {
    console.error(error.message);
    process.exit(1);
  }
}

const title = args.title.trim();
const content = [
  '---',
  'schema_version: 0.1.0',
  `id: ${issueId}`,
  `namespace: ${project.namespace}`,
  `project: ${project.key}`,
  `title: ${title}`,
  `issue_type: ${issueType}`,
  'canonical_state: backlog',
  'gate_state: pending',
  'status: candidate',
  'definition_readiness: draft',
  'depends_on: []',
  'prevention-rule-ref:',
  '  - no-prior-failure',
  'authoring_path: starter.issue-create',
  'authoring_contract_version: starter-first-use-v1',
  'created_at: ' + createdAt,
  'updated_at: ' + createdAt,
  '---',
  '',
  `# ${issueId} ${title}`,
  '',
  '## Brief',
  '',
  '_Describe the user-visible goal._',
  '',
  '## Evidence',
  '',
  '- _Why this issue exists._',
  '',
  '## Acceptance Criteria',
  '',
  '- [ ] _Observable completion criterion._',
  '',
  '## Development Plan',
  '',
  '1. _Plan the smallest useful change._',
  '',
  '## Test Plan',
  '',
  '- `node scripts/pokit-doctor.mjs`',
  '',
  '## Subagent Plan',
  '',
  'Use a worker only when the change is large enough to split safely.',
  '',
  '## QA',
  '',
  '- `node scripts/pokit-doctor.mjs`',
  '',
  '## Gate',
  '',
  'Pending.',
  '',
  '## Memory',
  '',
  `- ${createdAt}: Issue created from starter CLI.`,
  '',
].join('\n');

await mkdir(path.dirname(issuePath), { recursive: true });
await writeFile(issuePath, content, 'utf8');

if (!args.id) {
  const registry = await readRegistry(root);
  const target = registry.projects.find((entry) => entry.key === project.key);
  target.next_number = Number(target.next_number) + 1;
  await writeRegistry(root, registry);
}

const receipt = {
  event_type: 'issue_authored',
  event_name: 'issue_authored',
  issue_id: issueId,
  created_at: createdAt,
  emitted_at: new Date().toISOString(),
  provider: 'starter_cli',
  content_hash: createHash('sha256').update(`${issueId} ${title} ${createdAt}`).digest('hex').slice(0, 16),
  payload: {
    schema_version: '0.1.0',
    event_name: 'issue_authored',
    issue_id: issueId,
    title,
  },
};

await mkdir(path.join(root, '.ai-os', 'events'), { recursive: true });
await appendFile(path.join(root, '.ai-os', 'events', 'event-log.jsonl'), `${JSON.stringify(receipt)}\n`, 'utf8');

if (args.activate) {
  await updateCurrent(root, {
    active_project: project.key,
    active_issue: issueId,
    gate_state: 'pending',
    next_action: `${issueId} 실행 준비`,
    updated_at: createdAt,
  });
}

console.log(JSON.stringify({
  status: 'pass',
  issue: issueId,
  project: project.key,
  path: path.relative(root, issuePath),
  receipt: '.ai-os/events/event-log.jsonl',
}, null, 2));
