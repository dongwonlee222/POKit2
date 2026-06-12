#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildEvidenceIndex,
  parseArgs,
} from './lib/derived-index.mjs';

const args = parseArgs(process.argv.slice(2));
const generatedAt = valueAfter(process.argv.slice(2), '--generated-at') ?? new Date().toISOString();
const index = await buildEvidenceIndex(args.root, { generatedAt });
const json = `${JSON.stringify(index, null, 2)}\n`;

if (process.argv.includes('--write')) {
  const outputPath = path.join(args.root, '.ai-os/events/evidence-index.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json, 'utf8');
} else {
  console.log(json.trimEnd());
}

function valueAfter(argv, key) {
  const index = argv.indexOf(key);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}
