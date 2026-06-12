#!/usr/bin/env node
import {
  buildArtifactIndexRows,
  markdownTable,
  parseArgs,
} from './lib/derived-index.mjs';

const args = parseArgs(process.argv.slice(2));
const rows = await buildArtifactIndexRows(args.root);

console.log('<!-- generated preview: source of truth is artifact frontmatter/files -->');
console.log(markdownTable(['Artifact', 'Type', 'Path'], rows));
