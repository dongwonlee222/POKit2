#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const current = await readFile(path.join(root, '.ai-os/current.md'), 'utf8');
const startup = await measure(readOrder(current, 'start_read_order'));
const work = await measure(readOrder(current, 'work_read_order'));

console.log(JSON.stringify({
  status: 'pass',
  startup_token_count: startup.tokens,
  work_read_token_count: work.tokens,
  total_session_input: startup.tokens + work.tokens,
  breakdown: { startup: startup.files, work: work.files },
}, null, 2));

function readOrder(text, heading) {
  const match = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(text);
  if (!match) return [];
  const rest = text.slice(match.index + match[0].length);
  const next = /\n##\s+/.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  return section
    .split('\n')
    .map((line) => line.match(/^\d+\.\s+`([^`]+)`/)?.[1])
    .filter(Boolean);
}

async function measure(files) {
  const rows = [];
  let bytes = 0;
  for (const file of files) {
    let size = 0;
    let exists = true;
    try {
      size = (await stat(path.join(root, file))).size;
    } catch {
      exists = false;
    }
    bytes += size;
    rows.push({ path: file, bytes: size, tokens: Math.ceil(size / 4), exists });
  }
  return { tokens: Math.ceil(bytes / 4), files: rows };
}
