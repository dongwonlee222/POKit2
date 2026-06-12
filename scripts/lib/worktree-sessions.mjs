import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { acquireIssueLock, resolveLockRoot } from './worktree-locks.mjs';

export const SESSION_SCHEMA_VERSION = '0.1.0';

function jsonWithNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatDatePart(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '_',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function assertIssueId(issueId) {
  if (!/^[A-Z]+-\d{3}$/.test(String(issueId ?? ''))) {
    throw new Error('issueId must look like POK-224');
  }
}

function assertBranchSafeSessionId(sessionId) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(sessionId ?? ''))) {
    throw new Error('sessionId must be branch safe');
  }
}

function runGit(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }
  return result.stdout.trim();
}

function gitSucceeds(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0;
}

function gitOutput(root, args) {
  return runGit(root, args).replace(/^\/private/, '');
}

function resolveGitPath(root, gitPath) {
  return path.resolve(root, gitPath).replace(/^\/private/, '');
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

export function createTaskSessionId({ now = new Date(), randomBytes = nodeRandomBytes(4) } = {}) {
  const entropy = Buffer.isBuffer(randomBytes)
    ? randomBytes.toString('hex').slice(0, 8)
    : Buffer.from(randomBytes).toString('hex').slice(0, 8);
  return `ses_${formatDatePart(now)}_${entropy.padEnd(8, '0')}`;
}

export async function resolveSessionRoot(root) {
  const lockRoot = await resolveLockRoot(root);
  const basePath = lockRoot.mode === 'git-common-dir'
    ? lockRoot.path
    : path.dirname(lockRoot.path);
  return {
    mode: lockRoot.mode,
    path: basePath,
    sessionsPath: path.join(basePath, 'sessions'),
    proposedUpdatesPath: path.join(basePath, 'proposed-updates'),
  };
}

export async function resolveSessionRole(root) {
  const gitDir = gitOutput(root, ['rev-parse', '--git-dir']);
  const gitCommonDir = gitOutput(root, ['rev-parse', '--git-common-dir']);
  const resolvedGitDir = resolveGitPath(root, gitDir);
  const resolvedCommonDir = resolveGitPath(root, gitCommonDir);
  const role = resolvedGitDir === resolvedCommonDir ? 'main_session' : 'task_session';
  return {
    role,
    git_dir: resolvedGitDir,
    git_common_dir: resolvedCommonDir,
  };
}

export function buildTaskSessionMetadata({
  project = 'pokit',
  issueId,
  engine = 'unknown',
  sessionId = createTaskSessionId(),
  branch,
  worktreePath,
  createdBy = 'pokit_created',
  state = 'active',
  holder = null,
  proposedUpdatePath = null,
}) {
  assertIssueId(issueId);
  assertBranchSafeSessionId(sessionId);
  if (!branch) throw new Error('branch is required');
  if (!worktreePath) throw new Error('worktreePath is required');
  return {
    schema_version: SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    display_id: null,
    role: 'task_session',
    project,
    issue_id: issueId,
    engine,
    branch,
    worktree_path: path.resolve(worktreePath),
    state,
    holder,
    created_by: createdBy,
    created_at: nowIso(),
    proposed_update_path: proposedUpdatePath,
    permissions: {
      can_modify_worktree: true,
      can_write_shared_state: false,
      can_gate_claim: false,
      can_push: false,
      can_create_or_activate_issues: false,
    },
  };
}

export function buildMainSessionMetadata({
  project = 'pokit',
  issueId,
  engine = 'unknown',
  sessionId = createTaskSessionId(),
  branch,
  worktreePath,
  createdBy = 'repo_root_session',
  state = 'active',
}) {
  assertIssueId(issueId);
  assertBranchSafeSessionId(sessionId);
  if (!branch) throw new Error('branch is required');
  if (!worktreePath) throw new Error('worktreePath is required');
  return {
    schema_version: SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    display_id: null,
    role: 'main_session',
    project,
    issue_id: issueId,
    engine,
    branch,
    worktree_path: path.resolve(worktreePath),
    state,
    holder: sessionId,
    created_by: createdBy,
    created_at: nowIso(),
    proposed_update_path: null,
    permissions: {
      can_modify_worktree: true,
      can_write_shared_state: true,
      can_gate_claim: true,
      can_push: false,
      can_create_or_activate_issues: true,
    },
  };
}

async function writeSessionMetadata(root, session) {
  const sessionRoot = await resolveSessionRoot(root);
  await mkdir(sessionRoot.sessionsPath, { recursive: true });
  const sessionPath = path.join(sessionRoot.sessionsPath, `${session.session_id}.json`);
  await writeFile(sessionPath, jsonWithNewline(session), { encoding: 'utf8', flag: 'wx' });
  return { sessionRoot, sessionPath };
}

async function readTaskSessionIfExists(root, sessionId) {
  try {
    return await readTaskSession(root, sessionId);
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    return null;
  }
}

async function findExistingSessionForWorktree(root, { issueId, worktreePath }) {
  const sessionRoot = await resolveSessionRoot(root);
  let entries;
  try {
    entries = await readdir(sessionRoot.sessionsPath, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
  const resolvedWorktree = path.resolve(worktreePath).replace(/^\/private/, '');
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const session = JSON.parse(await readFile(path.join(sessionRoot.sessionsPath, entry.name), 'utf8'));
      const sessionWorktree = path.resolve(session.worktree_path ?? '').replace(/^\/private/, '');
      if (
        session.issue_id === issueId &&
        sessionWorktree === resolvedWorktree &&
        session.state !== 'closed'
      ) {
        return session;
      }
    } catch {
      // Ignore malformed session metadata; doctor should surface registry drift.
    }
  }
  return null;
}

export function createTaskSessionHandoff(session) {
  return [
    `You are a POKit task_session for ${session.issue_id}.`,
    '',
    `role: ${session.role}`,
    `engine: ${session.engine}`,
    `session_id: ${session.session_id}`,
    `cwd: ${session.worktree_path}`,
    `branch: ${session.branch}`,
    `proposed_update: ${session.proposed_update_path}`,
    '',
    'Allowed:',
    '- Modify files only inside this worktree.',
    '- Run focused tests, lint, build, or local verification.',
    '- Write exactly one proposed_update for the integration session.',
    '- Record backlog_suggestion entries for newly discovered work.',
    '',
    'Forbidden:',
    '- DO NOT mark gate_passed.',
    '- DO NOT update .ai-os/current.md, status-board, handoff, issue-index, or release-scope.',
    '- DO NOT push, merge to main, or make final integration commits.',
    '- DO NOT create or activate new issues; use backlog_suggestion instead.',
    '',
    'Stop after writing proposed_update and report the path to the main/integration session.',
  ].join('\n');
}

export async function createTaskSession(root, {
  project = 'pokit',
  issueId,
  engine = 'unknown',
  sessionId = createTaskSessionId(),
  worktreeRoot = path.resolve(root, '..', `${path.basename(root)}-worktrees`),
  holder = sessionId,
  reason = `create task session for ${issueId}`,
} = {}) {
  assertIssueId(issueId);
  assertBranchSafeSessionId(sessionId);
  const issueLock = await acquireIssueLock(root, {
    issueId,
    holder,
    reason,
  });
  if (!issueLock.acquired) throw new Error(issueLock.message);
  const issueLockHolder = issueLock.lock?.holder ?? holder;

  const branch = `pokit/${project}/${issueId}/${sessionId}`;
  const worktreePath = path.resolve(worktreeRoot, `${issueId}-${sessionId}`);
  if (gitSucceeds(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])) {
    throw new Error(`branch already exists: ${branch}`);
  }
  if (await exists(worktreePath)) {
    throw new Error(`worktree already exists: ${worktreePath}`);
  }

  await mkdir(worktreeRoot, { recursive: true });
  runGit(root, ['worktree', 'add', '-b', branch, worktreePath, 'HEAD']);

  const sessionRoot = await resolveSessionRoot(root);
  const proposedUpdatePath = path.join(sessionRoot.proposedUpdatesPath, issueId, `${sessionId}.json`);
  const session = buildTaskSessionMetadata({
    project,
    issueId,
    engine,
    sessionId,
    branch,
    worktreePath,
    holder: issueLockHolder,
    proposedUpdatePath: path.relative(root, proposedUpdatePath),
  });
  const { sessionPath } = await writeSessionMetadata(root, session);
  return {
    session,
    session_path: sessionPath,
    handoff: createTaskSessionHandoff(session),
  };
}

export async function adoptTaskSession(root, {
  project = 'pokit',
  issueId,
  engine = 'unknown',
  sessionId = createTaskSessionId(),
  branch,
  worktreePath,
  holder = sessionId,
  reason = `adopt task session for ${issueId}`,
} = {}) {
  assertIssueId(issueId);
  assertBranchSafeSessionId(sessionId);
  if (!branch) throw new Error('branch is required');
  if (!worktreePath) throw new Error('worktreePath is required');
  const resolvedWorktree = path.resolve(worktreePath);
  if (!(await exists(resolvedWorktree))) throw new Error(`worktree does not exist: ${resolvedWorktree}`);
  const rootCommonDir = gitOutput(root, ['rev-parse', '--git-common-dir']);
  const worktreeCommonDir = gitOutput(resolvedWorktree, ['rev-parse', '--git-common-dir']);
  if (path.resolve(root, rootCommonDir).replace(/^\/private/, '') !== path.resolve(resolvedWorktree, worktreeCommonDir).replace(/^\/private/, '')) {
    throw new Error(`worktree is not attached to this repository: ${resolvedWorktree}`);
  }
  const activeBranch = gitOutput(resolvedWorktree, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (activeBranch !== branch) {
    throw new Error(`worktree branch mismatch: expected ${branch}, got ${activeBranch}`);
  }

  const issueLock = await acquireIssueLock(root, {
    issueId,
    holder,
    reason,
  });
  if (!issueLock.acquired) throw new Error(issueLock.message);
  const issueLockHolder = issueLock.lock?.holder ?? holder;

  const sessionRoot = await resolveSessionRoot(root);
  const proposedUpdatePath = path.join(sessionRoot.proposedUpdatesPath, issueId, `${sessionId}.json`);
  const session = buildTaskSessionMetadata({
    project,
    issueId,
    engine,
    sessionId,
    branch,
    worktreePath: resolvedWorktree,
    holder: issueLockHolder,
    proposedUpdatePath: path.relative(root, proposedUpdatePath),
    createdBy: 'tool_native_adopt',
  });
  const { sessionPath } = await writeSessionMetadata(root, session);
  return {
    session,
    session_path: sessionPath,
    handoff: createTaskSessionHandoff(session),
  };
}

export async function readTaskSession(root, sessionId) {
  const sessionRoot = await resolveSessionRoot(root);
  return JSON.parse(await readFile(path.join(sessionRoot.sessionsPath, `${sessionId}.json`), 'utf8'));
}

export async function listActiveIssueClaims(root) {
  const sessionRoot = await resolveSessionRoot(root);
  let entries;
  try {
    entries = await readdir(sessionRoot.sessionsPath, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  const claims = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const session = JSON.parse(await readFile(path.join(sessionRoot.sessionsPath, entry.name), 'utf8'));
      if (
        /^[A-Z]+-\d{3}$/.test(String(session.issue_id ?? '')) &&
        session.state !== 'closed' &&
        session.state !== 'gate_passed' &&
        session.state !== 'abandoned'
      ) {
        claims.push({
          issue_id: session.issue_id,
          session_id: session.session_id ?? entry.name.replace(/\.json$/, ''),
          role: session.role ?? 'session',
          state: session.state ?? 'active',
          worktree_path: session.worktree_path ?? null,
        });
      }
    } catch {
      // Ignore malformed session metadata; doctor/GC can surface registry drift.
    }
  }
  return claims;
}

export async function ensureCurrentSession(root, {
  project = 'pokit',
  issueId,
  engine = 'unknown',
  sessionId = process.env.POKIT_SESSION_ID || createTaskSessionId(),
  holder = sessionId,
  reason = `ensure current session for ${issueId}`,
} = {}) {
  assertIssueId(issueId);
  assertBranchSafeSessionId(sessionId);
  const existing = await readTaskSessionIfExists(root, sessionId);
  if (existing) {
    return { session: existing, session_path: null, idempotent: true };
  }
  const existingForWorktree = await findExistingSessionForWorktree(root, { issueId, worktreePath: root });
  if (existingForWorktree) {
    return { session: existingForWorktree, session_path: null, idempotent: true };
  }

  const sessionRole = await resolveSessionRole(root);
  const branch = gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (sessionRole.role === 'task_session') {
    try {
      return await adoptTaskSession(root, {
        project,
        issueId,
        engine,
        sessionId,
        branch,
        worktreePath: root,
        holder,
        reason,
      });
    } catch (err) {
      if (err?.code === 'EEXIST' || /already registered/.test(String(err?.message ?? ''))) {
        const registered = await readTaskSessionIfExists(root, sessionId);
        if (registered) return { session: registered, session_path: null, idempotent: true };
      }
      throw err;
    }
  }

  const session = buildMainSessionMetadata({
    project,
    issueId,
    engine,
    sessionId,
    branch,
    worktreePath: root,
  });
  try {
    const { sessionPath } = await writeSessionMetadata(root, session);
    return { session, session_path: sessionPath };
  } catch (err) {
    if (err?.code === 'EEXIST') {
      const registered = await readTaskSessionIfExists(root, sessionId);
      if (registered) return { session: registered, session_path: null, idempotent: true };
    }
    throw err;
  }
}
