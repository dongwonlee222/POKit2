import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { resolveSessionRoot } from './worktree-sessions.mjs';

const COLLECTABLE_STATES = new Set(['completed', 'integrated', 'abandoned', 'closed']);
const execFileAsync = promisify(execFile);

function jsonWithNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizePath(value) {
  return path.resolve(String(value ?? '')).replace(/^\/private/, '');
}

function parseRetentionDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('retentionDays must be a non-negative integer');
  }
  return days;
}

export function retentionCutoffIso({ now = new Date(), retentionDays = 14 } = {}) {
  const days = parseRetentionDays(retentionDays);
  return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function listSessionFiles(root) {
  const sessionRoot = await resolveSessionRoot(root);
  let entries;
  try {
    entries = await readdir(sessionRoot.sessionsPath, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return { sessionRoot, files: [] };
    throw err;
  }
  return {
    sessionRoot,
    files: entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(sessionRoot.sessionsPath, entry.name)),
  };
}

function isCurrentSession(session, opts) {
  const currentSessionId = opts.currentSessionId ?? null;
  const currentWorktreePath = opts.currentWorktreePath ? normalizePath(opts.currentWorktreePath) : null;
  if (currentSessionId && session.session_id === currentSessionId) return true;
  if (currentWorktreePath && normalizePath(session.worktree_path) === currentWorktreePath) return true;
  return false;
}

function isSafeWorktreePath(session) {
  if (session.created_by !== 'pokit_created') return false;
  if (!path.isAbsolute(String(session.worktree_path ?? ''))) return false;
  if (!/^[A-Z]+-\d{3}$/.test(String(session.issue_id ?? ''))) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(String(session.session_id ?? ''))) return false;

  const resolved = path.resolve(session.worktree_path);
  const parent = path.dirname(resolved);
  const basename = path.basename(resolved);
  if (resolved === parent || parent === path.dirname(parent)) return false;
  return basename === `${session.issue_id}-${session.session_id}`;
}

function classifySession(session, opts) {
  if (isCurrentSession(session, opts)) {
    return { action: 'skip', reason: 'protected_current_session' };
  }
  if (!COLLECTABLE_STATES.has(String(session.state ?? ''))) {
    return { action: 'skip', reason: 'state_not_collectable' };
  }
  if (!isSafeWorktreePath(session)) {
    return { action: 'skip', reason: 'unsafe_worktree_path' };
  }
  if (!session.created_at || Number.isNaN(Date.parse(session.created_at))) {
    return { action: 'skip', reason: 'missing_created_at' };
  }
  if (new Date(session.created_at).getTime() > opts.cutoff.getTime()) {
    return { action: 'skip', reason: 'within_retention' };
  }
  return { action: 'delete', reason: 'expired_completed_session' };
}

function entryFromSession(session, sessionPath, opts) {
  const classification = classifySession(session, opts);
  return {
    session_id: session.session_id ?? null,
    issue_id: session.issue_id ?? null,
    state: session.state ?? null,
    created_at: session.created_at ?? null,
    worktree_path: session.worktree_path ?? null,
    session_path: sessionPath,
    action: classification.action,
    reason: classification.reason,
  };
}

export async function planWorktreeGc(root, {
  now = new Date(),
  retentionDays = 14,
  currentSessionId = null,
  currentWorktreePath = process.cwd(),
} = {}) {
  const retention_days = parseRetentionDays(retentionDays);
  const cutoff = new Date(retentionCutoffIso({ now, retentionDays: retention_days }));
  const { sessionRoot, files } = await listSessionFiles(root);
  const opts = { cutoff, currentSessionId, currentWorktreePath };
  const entries = [];

  for (const filePath of files) {
    const session = await readJson(filePath);
    entries.push(entryFromSession(session, filePath, opts));
  }

  entries.sort((a, b) => String(a.session_id).localeCompare(String(b.session_id)));
  return {
    dry_run: true,
    root: path.resolve(root),
    session_root: sessionRoot.sessionsPath,
    retention_days,
    cutoff_iso: cutoff.toISOString(),
    entries,
  };
}

export async function cleanupWorktreeGc(root, opts = {}) {
  const plan = await planWorktreeGc(root, opts);
  const entries = [];
  const runGit = opts.runGit ?? (async (args) => {
    const { stdout } = await execFileAsync('git', args, { cwd: root });
    return stdout;
  });
  const gitWorktrees = await listGitWorktreePaths({ root, runGit });

  for (const entry of plan.entries) {
    if (entry.action !== 'delete') {
      entries.push(entry);
      continue;
    }
    if (!(await pathExists(entry.worktree_path))) {
      entries.push({ ...entry, action: 'skip', reason: 'worktree_missing' });
      continue;
    }
    if (!gitWorktrees.has(normalizePath(entry.worktree_path))) {
      entries.push({ ...entry, action: 'skip', reason: 'not_git_worktree' });
      continue;
    }
    if (!(await isGitWorktreeClean({ worktreePath: entry.worktree_path, runGit }))) {
      entries.push({ ...entry, action: 'skip', reason: 'dirty_worktree' });
      continue;
    }
    await runGit(['worktree', 'remove', entry.worktree_path]);
    entries.push({ ...entry, action: 'deleted' });
  }

  return {
    ...plan,
    dry_run: false,
    entries,
  };
}

async function listGitWorktreePaths({ runGit }) {
  try {
    const stdout = await runGit(['worktree', 'list', '--porcelain']);
    const paths = new Set();
    for (const line of String(stdout).split('\n')) {
      const match = line.match(/^worktree\s+(.+)$/);
      if (match) paths.add(normalizePath(match[1]));
    }
    return paths;
  } catch {
    return new Set();
  }
}

async function isGitWorktreeClean({ worktreePath, runGit }) {
  try {
    const stdout = await runGit(['-C', worktreePath, 'status', '--porcelain']);
    return String(stdout).trim().length === 0;
  } catch {
    return false;
  }
}

export function formatWorktreeGcJson(result) {
  return jsonWithNewline(result);
}
