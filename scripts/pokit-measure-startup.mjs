#!/usr/bin/env node
// POK-141 — startup/work read budget estimator.
//
// Parses `.ai-os/current.md` for `start_read_order` and `work_read_order`,
// reads each referenced file, and estimates token counts using a conservative
// `bytes / 4` heuristic (1 token ≈ 4 bytes for English text — slight under-
// count for CJK, which is acceptable for a budget gate).
//
// Output: JSON to stdout with startup_token_count, work_read_token_count,
// total_session_input, and per-file breakdown for debugging.

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTION_HEADERS = {
  startup: /^##\s+start_read_order\s*$/m,
  work: /^##\s+work_read_order\s*$/m,
};

export function parseReadOrder(currentMdText, sectionName) {
  const header = SECTION_HEADERS[sectionName];
  if (!header) throw new Error(`Unknown section: ${sectionName}`);
  const match = header.exec(currentMdText);
  if (!match) return [];
  const sliceStart = match.index + match[0].length;
  const remainder = currentMdText.slice(sliceStart);
  const nextHeader = /\n##\s+/.exec(remainder);
  const section = nextHeader ? remainder.slice(0, nextHeader.index) : remainder;

  const paths = [];
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    // Match numbered list items with backticked paths: `1. \`some/path\``
    const m = line.match(/^\d+\.\s+`([^`]+)`/);
    if (m) paths.push(m[1]);
  }
  return paths;
}

export function estimateTokens(byteCount) {
  return Math.ceil(byteCount / 4);
}

async function measureFiles(root, relPaths) {
  const breakdown = [];
  let totalBytes = 0;
  for (const rel of relPaths) {
    const abs = path.join(root, rel);
    let bytes = 0;
    let exists = true;
    try {
      const st = await stat(abs);
      bytes = st.size;
    } catch {
      exists = false;
    }
    totalBytes += bytes;
    breakdown.push({ path: rel, bytes, tokens: estimateTokens(bytes), exists });
  }
  return { totalBytes, totalTokens: estimateTokens(totalBytes), breakdown };
}

export async function measureStartup({ root = process.cwd() } = {}) {
  const currentMd = await readFile(path.join(root, '.ai-os/current.md'), 'utf8');
  const startupPaths = parseReadOrder(currentMd, 'startup');
  const workPaths = parseReadOrder(currentMd, 'work');

  const startup = await measureFiles(root, startupPaths);
  const work = await measureFiles(root, workPaths);

  return {
    startup_token_count: startup.totalTokens,
    work_read_token_count: work.totalTokens,
    total_session_input: startup.totalTokens + work.totalTokens,
    breakdown: {
      startup: startup.breakdown,
      work: work.breakdown,
    },
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const result = await measureStartup({ root: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
}
