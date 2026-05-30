#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { listIssueFiles, parseFrontmatter } from './pokit-project-contract.mjs';

const root = process.cwd();
const rows = [];

for (const { relativePath, project } of await listIssueFiles(root)) {
  const text = await readFile(path.join(root, relativePath), 'utf8');
  const fm = parseFrontmatter(text);
  rows.push({
    id: fm.id ?? path.basename(relativePath, '.md'),
    project: fm.project ?? project.key,
    title: fm.title ?? firstHeading(text) ?? path.basename(relativePath),
    status: fm.status ?? fm.gate_state ?? fm.canonical_state ?? 'unknown',
    path: relativePath,
  });
}

console.log(markdownTable(['Issue', 'Project', 'Title', 'Status', 'Path'], rows.map((row) => [
  row.id,
  row.project,
  row.title,
  row.status,
  `\`${row.path}\``,
])));

function firstHeading(text) {
  return text.match(/^#\s+(.+)$/m)?.[1] ?? null;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}
