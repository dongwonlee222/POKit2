#!/usr/bin/env node
import {
  buildGroupedBacklog,
  buildIssueIndexRows,
  buildProjectLocalIssueRows,
  markdownTable,
  parseArgs,
  renderGroupedBacklogCard,
} from './lib/derived-index.mjs';

const args = parseArgs(process.argv.slice(2));

if (args.grouped) {
  const grouped = await buildGroupedBacklog(args.root, { sprint: args.sprint, groupBy: args.groupBy });
  console.log(renderGroupedBacklogCard(grouped));
} else {
  const rows = args.projectLocal
    ? await buildProjectLocalIssueRows(args.root, {
      status: args.status,
    })
    : await buildIssueIndexRows(args.root, {
      sprint: args.sprint,
      status: args.status,
    });

  console.log('<!-- generated preview: source of truth is issue card frontmatter -->');
  console.log(markdownTable(['ID', 'Title', 'Status', 'Sprint', 'Path'], rows));
}
