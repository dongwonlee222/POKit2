#!/usr/bin/env node
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const currentPath = path.join(root, '.ai-os', 'current.md');
const handoffPath = path.join(root, '.ai-os', 'memory', 'session', 'handoff.md');
const current = await readFile(currentPath, 'utf8');
const handoff = await readFile(handoffPath, 'utf8');
const frontmatter = parseFrontmatter(current);
const sprint = process.argv[2] ?? frontmatter.active_sprint;

if (!/^v\d+\.\d+\.\d+$/.test(sprint ?? '')) {
  console.error('Usage: node scripts/pokit-sprint-close.mjs v0.1.0');
  process.exit(1);
}

const archiveRel = `.ai-os/memory/session/archive/handoff-${sprint}.md`;
const archivePath = path.join(root, archiveRel);
const retroRel = `docs/${sprint}/retro.md`;
const retroPath = path.join(root, retroRel);

try {
  await stat(archivePath);
  throw new Error(`Archive already exists: ${archiveRel}`);
} catch (error) {
  if (error?.code !== 'ENOENT') {
    console.error(error.message);
    process.exit(1);
  }
}

await mkdir(path.dirname(archivePath), { recursive: true });
await writeFile(archivePath, handoff, 'utf8');

await mkdir(path.dirname(retroPath), { recursive: true });
try {
  await stat(retroPath);
} catch (error) {
  if (error?.code === 'ENOENT') {
    await writeFile(retroPath, retroTemplate(sprint), 'utf8');
  } else {
    throw error;
  }
}

const compact = [
  '# Handoff',
  '',
  '## Active Snapshot',
  '',
  `- active_project: ${frontmatter.active_project ?? 'unknown'}`,
  `- active_issue: ${frontmatter.active_issue ?? 'unknown'}`,
  `- gate_state: ${frontmatter.gate_state ?? 'unknown'}`,
  `- active_sprint: ${sprint}`,
  '',
  `Next action: review ${retroRel}, then start the next issue.`,
  '',
  '## Archive Pointer',
  '',
  `- ${sprint}: \`${archiveRel}\``,
  '',
].join('\n');

const tempPath = `${handoffPath}.tmp-${process.pid}`;
await writeFile(tempPath, compact, 'utf8');
await rename(tempPath, handoffPath);

console.log(JSON.stringify({
  status: 'pass',
  sprint,
  archive: archiveRel,
  retro: retroRel,
}, null, 2));

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) result[field[1]] = field[2].replace(/^["']|["']$/g, '').trim();
  }
  return result;
}

function retroTemplate(sprint) {
  return [
    `# ${sprint} Retro`,
    '',
    '## Summary',
    '',
    '- _What changed?_',
    '',
    '## What Worked',
    '',
    '- _Keep doing._',
    '',
    '## What Failed',
    '',
    '- _Fix or prevent._',
    '',
    '## Metrics',
    '',
    '- startup_token_count: _run `node scripts/pokit-measure-startup.mjs`_',
    '- elapsed_time: _fill manually or from your workflow receipts_',
    '',
    '## Decisions',
    '',
    '- _What is now standard?_',
    '',
    '## Follow-Ups',
    '',
    '- _Next issue candidates._',
    '',
  ].join('\n');
}
