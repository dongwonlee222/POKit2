#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const rows = [];

for (const location of ['projects/pokit/issues', '.ai-os']) {
  let entries = [];
  try {
    entries = await readdir(path.join(root, location), { withFileTypes: true });
  } catch {
    continue;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !/^POK-\d+\.md$/.test(entry.name)) continue;
    const relPath = `${location}/${entry.name}`;
    const text = await readFile(path.join(root, relPath), 'utf8');
    const fm = parseFrontmatter(text);
    rows.push({
      id: fm.id ?? entry.name.replace(/\.md$/, ''),
      title: fm.title ?? firstHeading(text) ?? entry.name,
      status: fm.status ?? fm.gate_state ?? fm.canonical_state ?? 'unknown',
      path: relPath,
    });
  }
}

rows.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
console.log(markdownTable(['Issue', 'Title', 'Status', 'Path'], rows.map((row) => [
  row.id,
  row.title,
  row.status,
  `\`${row.path}\``,
])));

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
