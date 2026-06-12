#!/usr/bin/env node
import path from 'node:path';

import { hasProjectState, readProjectState, renderProjectViews } from './lib/project-state.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') args.root = argv[++index];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);

// POK-262: project:list is a read-only view. It must NOT call ensureProjectState
// (writes local .pokit state + registers the project in the global ~/.pokit registry)
// nor let renderProjectViews persist .pokit/current.md / .pokit/handoff.md — a "show me
// the list" command leaking a durable write violates "조회는 읽기전용".
if (!(await hasProjectState(root))) {
  console.log('프로젝트 상태가 초기화되지 않았습니다. `project:init`으로 먼저 생성하세요.');
  process.exit(0);
}

// POK-262: readProjectState reads project-state.json / seq.json with no fallback, so a
// half-initialized root (config.json present but the others missing) would throw. A view
// command must degrade gracefully and stay read-only — never auto-heal (that was the old
// ensureProjectState write leak) and never crash with a raw stack.
let state;
try {
  state = await readProjectState(root);
} catch {
  console.log('프로젝트 상태가 불완전합니다 (.pokit 파일 일부 누락). `project:init`으로 복구하세요.');
  process.exit(0);
}

const { config, projectState, seq, activeProject } = state;
const rendered = await renderProjectViews(root, { config, projectState, seq, activeProject }, { write: false });

console.log(rendered.current);
console.log('');
for (const project of config.projects) {
  const marker = project.key === activeProject.key ? '*' : '-';
  console.log(`${marker} ${project.key} (${project.prefix})`);
}
