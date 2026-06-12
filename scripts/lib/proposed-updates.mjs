import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { readTaskSession, resolveSessionRoot } from './worktree-sessions.mjs';

export const PROPOSED_UPDATE_SCHEMA_VERSION = '0.1.0';
export const DECISIONS = new Set(['accept', 'reject', 'request_changes']);

function nowIso() {
  return new Date().toISOString();
}

function jsonWithNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertIssueId(issueId) {
  if (!/^[A-Z]+-\d{3}$/.test(String(issueId ?? ''))) {
    throw new Error('issueId must look like POK-224');
  }
}

function assertSessionId(sessionId) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(sessionId ?? ''))) {
    throw new Error('sessionId must be branch safe');
  }
}

function normalizeList(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => String(item ?? '').trim() === '')) {
    throw new Error(`${field} is required`);
  }
  return value.map((item) => String(item).trim());
}

function normalizeChangedPath(value) {
  const raw = String(value ?? '').trim().replace(/\\/g, '/');
  if (!raw) throw new Error('changed_paths entry is required');
  if (path.posix.isAbsolute(raw)) throw new Error(`changed_paths must be relative: ${raw}`);
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '');
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`changed_paths must stay inside the worktree: ${raw}`);
  }
  if (
    normalized === '.git' ||
    normalized.startsWith('.git/') ||
    normalized === '.pokit' ||
    normalized.startsWith('.pokit/') ||
    normalized === '.ai-os' ||
    normalized.startsWith('.ai-os/')
  ) {
    throw new Error(`task sessions cannot propose shared-state path changes: ${normalized}`);
  }
  return normalized;
}

function normalizeChangedPaths(value) {
  return [...new Set(normalizeList(value, 'changed_paths').map(normalizeChangedPath))];
}

function normalizeBacklogSuggestions(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('backlog_suggestions must be an array');
  return value.map((item) => ({
    title: String(item.title ?? '').trim(),
    reason: String(item.reason ?? '').trim(),
  })).filter((item) => item.title && item.reason);
}

async function proposedUpdatePath(root, issueId, sessionId) {
  const sessionRoot = await resolveSessionRoot(root);
  return path.join(sessionRoot.proposedUpdatesPath, issueId, `${sessionId}.json`);
}

async function assertRegisteredTaskSession(root, issueId, sessionId) {
  const session = await readTaskSession(root, sessionId);
  if (session.issue_id !== issueId) throw new Error(`session ${sessionId} is not registered for ${issueId}`);
  if (session.role !== 'task_session') throw new Error(`session ${sessionId} is not a task_session`);
  if (session.permissions?.can_write_shared_state !== false) {
    throw new Error(`session ${sessionId} has invalid shared-state permissions`);
  }
  return session;
}

function normalizeIntegrationEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('accept requires integration_evidence');
  }
  const mergedCommit = String(value.merged_commit ?? '').trim();
  const verification = Array.isArray(value.verification) ? value.verification.map((item) => String(item).trim()).filter(Boolean) : [];
  if (!mergedCommit) throw new Error('accept requires integration_evidence.merged_commit');
  if (verification.length === 0) throw new Error('accept requires integration_evidence.verification');
  return {
    merged_commit: mergedCommit,
    verification,
    state_guarded: value.state_guarded === true,
  };
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

function gitTracked(root) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function diffPathsForBranch(root, branch) {
  const text = runGit(root, ['diff', '--name-only', `HEAD...${branch}`]);
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map(normalizeChangedPath);
}

function ensureChangedPathsMatchBranch(root, update, branch) {
  const branchPaths = new Set(diffPathsForBranch(root, branch));
  const declaredPaths = new Set(update.changed_paths);
  const missing = update.changed_paths.filter((changedPath) => !branchPaths.has(changedPath));
  if (missing.length > 0) {
    throw new Error(`proposed_update changed_paths not present on branch diff: ${missing.join(', ')}`);
  }
  const extra = [...branchPaths].filter((changedPath) => !declaredPaths.has(changedPath));
  if (extra.length > 0) {
    throw new Error(`branch contains undeclared changed paths: ${extra.join(', ')}`);
  }
}

function mergeTaskBranch(root, session, update) {
  if (!gitTracked(root)) throw new Error('accept requires git repo integration or integration_evidence');
  ensureChangedPathsMatchBranch(root, update, session.branch);
  runGit(root, [
    '-c', 'user.email=pokit@example.test',
    '-c', 'user.name=POKit Integration',
    'merge',
    '--no-ff',
    '--no-edit',
    session.branch,
  ]);
  const mergedCommit = runGit(root, ['rev-parse', 'HEAD']);
  return {
    merged_commit: mergedCommit,
    verification: update.verification_evidence,
    state_guarded: true,
  };
}

export async function writeProposedUpdate(root, {
  issueId,
  sessionId,
  engine = 'unknown',
  source = 'task_session',
  changedPaths,
  diffSummary,
  verificationEvidence,
  risks = ['none recorded'],
  mainDecisionNeeded,
  backlogSuggestions = [],
  workflowResult = null,
} = {}) {
  assertIssueId(issueId);
  assertSessionId(sessionId);
  await assertRegisteredTaskSession(root, issueId, sessionId);
  const changed_paths = normalizeChangedPaths(changedPaths);
  const verification_evidence = normalizeList(verificationEvidence, 'verification_evidence');
  if (!String(diffSummary ?? '').trim()) throw new Error('diff_summary is required');
  if (!String(mainDecisionNeeded ?? '').trim()) throw new Error('main_decision_needed is required');

  const update = {
    schema_version: PROPOSED_UPDATE_SCHEMA_VERSION,
    issue_id: issueId,
    session_id: sessionId,
    engine,
    source,
    state: 'proposed',
    diff_summary: String(diffSummary).trim(),
    changed_paths,
    verification_evidence,
    risks: Array.isArray(risks) && risks.length > 0 ? risks.map((risk) => String(risk)) : ['none recorded'],
    main_decision_needed: String(mainDecisionNeeded).trim(),
    backlog_suggestions: normalizeBacklogSuggestions(backlogSuggestions),
    workflow_result: workflowResult,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const filePath = await proposedUpdatePath(root, issueId, sessionId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, jsonWithNewline(update), { encoding: 'utf8', flag: 'wx' });
  return { update, path: filePath };
}

export async function readProposedUpdate(root, { issueId, sessionId }) {
  assertIssueId(issueId);
  assertSessionId(sessionId);
  return JSON.parse(await readFile(await proposedUpdatePath(root, issueId, sessionId), 'utf8'));
}

export async function listProposedUpdates(root, { issueId }) {
  assertIssueId(issueId);
  const sessionRoot = await resolveSessionRoot(root);
  const dir = path.join(sessionRoot.proposedUpdatesPath, issueId);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const updates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    updates.push(JSON.parse(await readFile(path.join(dir, entry.name), 'utf8')));
  }
  return updates;
}

function findAcceptedPathConflicts(target, updates) {
  const targetPaths = new Set(target.changed_paths);
  const conflicts = [];
  for (const update of updates) {
    if (update.session_id === target.session_id || update.state !== 'accepted') continue;
    for (const changedPath of update.changed_paths ?? []) {
      if (targetPaths.has(changedPath)) conflicts.push(changedPath);
    }
  }
  return [...new Set(conflicts)];
}

export async function decideProposedUpdate(root, {
  issueId,
  sessionId,
  decision,
  decidedBy,
  reason,
  integrationEvidence = null,
} = {}) {
  assertIssueId(issueId);
  assertSessionId(sessionId);
  if (!DECISIONS.has(decision)) throw new Error('decision must be accept, reject, or request_changes');
  if (!String(decidedBy ?? '').trim()) throw new Error('decidedBy is required');
  if (!String(reason ?? '').trim()) throw new Error('reason is required');

  const update = await readProposedUpdate(root, { issueId, sessionId });
  const session = await assertRegisteredTaskSession(root, issueId, sessionId);
  if (decision === 'accept') {
    const conflicts = findAcceptedPathConflicts(update, await listProposedUpdates(root, { issueId }));
    if (conflicts.length > 0) {
      throw new Error(`conflict detected for ${conflicts.join(', ')}`);
    }
    update.integration_evidence = integrationEvidence
      ? normalizeIntegrationEvidence(integrationEvidence)
      : mergeTaskBranch(root, session, update);
  }

  update.state = decision === 'accept'
    ? 'accepted'
    : decision === 'reject'
      ? 'rejected'
      : 'changes_requested';
  update.decision = {
    decision,
    decided_by: String(decidedBy).trim(),
    reason: String(reason).trim(),
    decided_at: nowIso(),
  };
  update.updated_at = nowIso();

  const filePath = await proposedUpdatePath(root, issueId, sessionId);
  await writeFile(filePath, jsonWithNewline(update), 'utf8');
  return { update, path: filePath };
}
