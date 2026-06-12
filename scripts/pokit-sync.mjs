#!/usr/bin/env node
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_DIR = '.ai-os/templates/commands';
const CLAUDE_COMMANDS_DIR = '.claude/commands';

export const TARGETS = [
  { src: 'backlog.md', dest: path.join(CLAUDE_COMMANDS_DIR, 'pokit.backlog.md') },
  { src: 'issue.md', dest: path.join(CLAUDE_COMMANDS_DIR, 'pokit.issue.md') },
  { src: 'clarify.md', dest: path.join(CLAUDE_COMMANDS_DIR, 'pokit.clarify.md') },
];

export const CODEX_SKILL_TARGETS = [
  {
    src: '.claude/skills/pokit-backlog/SKILL.md',
    dest: 'skills/pokit-backlog/SKILL.md',
    label: '$CODEX_HOME/skills/pokit-backlog/SKILL.md',
  },
  {
    src: '.claude/skills/pokit-issue/SKILL.md',
    dest: 'skills/pokit-issue/SKILL.md',
    label: '$CODEX_HOME/skills/pokit-issue/SKILL.md',
  },
];

export async function syncTemplates({
  root = process.cwd(),
  codexHome = process.env.CODEX_HOME ?? path.join(process.env.HOME ?? '', '.codex'),
  dryRun = false,
} = {}) {
  const results = { synced: [], verified: [], errors: [] };

  for (const target of TARGETS) {
    const srcPath = path.join(root, TEMPLATE_DIR, target.src);
    const destPath = path.join(root, target.dest);

    await syncFileTarget({
      srcPath,
      destPath,
      srcLabel: target.src,
      destLabel: target.dest,
      dryRun,
      results,
    });
  }

  for (const target of CODEX_SKILL_TARGETS) {
    await syncFileTarget({
      srcPath: path.join(root, target.src),
      destPath: path.join(codexHome, target.dest),
      srcLabel: target.src,
      destLabel: target.label,
      dryRun,
      results,
    });
  }

  return results;
}

async function syncFileTarget({ srcPath, destPath, srcLabel, destLabel, dryRun, results }) {
  try {
    await stat(srcPath);
  } catch {
    results.errors.push({ src: srcLabel, reason: 'source not found' });
    return;
  }

  if (dryRun) {
    results.synced.push({ src: srcLabel, dest: destLabel, dryRun: true });
    return;
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await copyFile(srcPath, destPath);
  results.synced.push({ src: srcLabel, dest: destLabel });

  const [sourceText, destText] = await Promise.all([
    readFile(srcPath, 'utf8'),
    readFile(destPath, 'utf8'),
  ]);
  if (sourceText === destText) {
    results.verified.push({ src: srcLabel, dest: destLabel, check: 'equal' });
  } else {
    results.errors.push({ src: srcLabel, dest: destLabel, reason: 'sync verification failed' });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const dryRun = process.argv.includes('--dry-run');
  const results = await syncTemplates({ dryRun });

  for (const item of results.synced) {
    const label = item.dryRun ? '[dry-run]' : '[synced]';
    console.log(`${label} ${item.src} → ${item.dest}`);
  }
  for (const item of results.verified) {
    console.log(`[verified] ${item.src} = ${item.dest}`);
  }
  for (const item of results.errors) {
    console.error(`[error] ${item.src}: ${item.reason}`);
  }

  process.exitCode = results.errors.length > 0 ? 1 : 0;
}
