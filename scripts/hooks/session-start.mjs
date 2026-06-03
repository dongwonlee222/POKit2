#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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

function runGit(root, args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

function gitOutput(root, args, fallback = '') {
  const result = runGit(root, args);
  return result.status === 0 ? result.stdout.trim() : fallback;
}

function createSessionId() {
  return `ses_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}_${randomBytes(4).toString('hex')}`;
}

async function findExistingSession(sessionsPath, { issueId, worktreePath }) {
  let entries;
  try {
    entries = await readdir(sessionsPath, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
  const resolvedWorktree = path.resolve(worktreePath).replace(/^\/private/, '');
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const session = JSON.parse(await readFile(path.join(sessionsPath, entry.name), 'utf8'));
      if (
        session.issue_id === issueId &&
        path.resolve(session.worktree_path ?? '').replace(/^\/private/, '') === resolvedWorktree &&
        session.state !== 'closed'
      ) {
        return session;
      }
    } catch {
      // Ignore malformed local session files.
    }
  }
  return null;
}

async function main({ root = process.cwd(), stderr = process.stderr } = {}) {
  try {
    const currentText = await readFile(path.join(root, '.ai-os/current.md'), 'utf8');
    const current = parseFrontmatter(currentText);
    const issueId = current.active_issue;
    if (!/^[A-Z]+-\d{3}$/.test(issueId ?? '')) return { ok: true, skipped: 'no-active-issue' };

    const commonDir = gitOutput(root, ['rev-parse', '--git-common-dir'], '.git');
    const gitDir = gitOutput(root, ['rev-parse', '--git-dir'], commonDir);
    const role = path.resolve(root, gitDir) === path.resolve(root, commonDir) ? 'main_session' : 'task_session';
    const sessionsPath = path.join(root, '.pokit/sessions');
    await mkdir(sessionsPath, { recursive: true });

    const existing = await findExistingSession(sessionsPath, { issueId, worktreePath: root });
    if (existing) return { ok: true, session_id: existing.session_id, role: existing.role, idempotent: true };

    const sessionId = createSessionId();
    const session = {
      schema_version: '0.1.0',
      session_id: sessionId,
      role,
      project: current.active_project ?? 'pokit',
      issue_id: issueId,
      engine: 'starter-session-start-hook',
      branch: gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
      worktree_path: path.resolve(root),
      state: 'active',
      created_by: 'session_start_hook',
      created_at: new Date().toISOString(),
    };
    await writeFile(path.join(sessionsPath, `${sessionId}.json`), `${JSON.stringify(session, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    return { ok: true, session_id: sessionId, role };
  } catch (err) {
    stderr.write(`warn: pokit_session_start_skipped — ${err.message}\n`);
    return { ok: false, error: err.message };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { main };
