#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureCurrentSession } from '../lib/worktree-sessions.mjs';
import { readActiveIssueForWorktree } from '../lib/worktree-active-issue.mjs';

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (field) data[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return data;
}

async function main({ root = process.cwd(), stderr = process.stderr } = {}) {
  try {
    const currentText = await readFile(path.join(root, '.ai-os/current.md'), 'utf8');
    const current = parseFrontmatter(currentText);
    const activeIssue = (await readActiveIssueForWorktree(root)).activeIssue ?? current.active_issue;
    if (!/^POK-\d{3}$/.test(activeIssue ?? '')) return { ok: true, skipped: 'no-active-issue' };

    const ensured = await ensureCurrentSession(root, {
      project: current.active_project ?? 'pokit',
      issueId: activeIssue,
      engine: 'session-start-hook',
      reason: `SessionStart registration for ${activeIssue}`,
    });
    return { ok: true, session_id: ensured.session.session_id, role: ensured.session.role };
  } catch (err) {
    stderr.write(`warn: pokit_session_start_skipped — ${err.message}\n`);
    return { ok: false, error: err.message };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { main };
