#!/usr/bin/env node
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (!args.id || !args.title) {
  console.error('Usage: node scripts/pokit-issue-create.mjs --id POK-001 --title "First real issue" --project my-project [--type implementation]');
  process.exit(1);
}

const root = process.cwd();
const createdAt = args.createdAt ?? new Date().toISOString().slice(0, 10);
const issueType = args.type ?? 'implementation';
const project = args.project ?? 'pokit';
const issueDir = path.join(root, 'projects', project, 'issues');
const issuePath = path.join(issueDir, `${args.id}.md`);

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
  `id: ${args.id}`,
  'namespace: POK',
  `project: ${project}`,
  `title: ${title}`,
  `issue_type: ${issueType}`,
  'canonical_state: backlog',
  'gate_state: pending',
  'status: candidate',
  'definition_readiness: draft',
  'depends_on: []',
  'created_at: ' + createdAt,
  'updated_at: ' + createdAt,
  '---',
  '',
  `# ${args.id} ${title}`,
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

await mkdir(issueDir, { recursive: true });
await writeFile(issuePath, content, 'utf8');

const receipt = {
  event_type: 'issue_authored',
  event_name: 'issue_authored',
  issue_id: args.id,
  created_at: createdAt,
  emitted_at: new Date().toISOString(),
  provider: 'starter_cli',
  content_hash: createHash('sha256').update(`${args.id} ${title} ${createdAt}`).digest('hex').slice(0, 16),
  payload: {
    schema_version: '0.1.0',
    event_name: 'issue_authored',
    issue_id: args.id,
    title,
  },
};

await mkdir(path.join(root, '.ai-os', 'events'), { recursive: true });
await appendFile(path.join(root, '.ai-os', 'events', 'event-log.jsonl'), `${JSON.stringify(receipt)}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'pass',
  issue: args.id,
  path: path.relative(root, issuePath),
  receipt: '.ai-os/events/event-log.jsonl',
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--id') parsed.id = argv[++index];
    else if (arg === '--title') parsed.title = argv[++index];
    else if (arg === '--type') parsed.type = argv[++index];
    else if (arg === '--project') parsed.project = argv[++index];
    else if (arg === '--created-at') parsed.createdAt = argv[++index];
  }
  return parsed;
}
