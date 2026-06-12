import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const LOCAL_ONLY_PREFIXES = [
  '.pokit/',
];

export async function classifyCommitStatus({
  root = process.cwd(),
  runGit,
} = {}) {
  const run =
    runGit ??
    (async (args) => {
      const { stdout } = await execFileAsync('git', args, { cwd: root });
      return stdout;
    });

  try {
    const stdout = await run(['status', '--porcelain=v1', '--untracked-files=all']);
    return classifyPorcelainStatus(stdout);
  } catch (error) {
    return {
      status: 'unknown',
      tracked_changes: [],
      local_only_untracked: [],
      other_untracked: [],
      dirty_paths: [],
      summary: `git status unavailable: ${error?.message ?? String(error)}`,
      commit_required: false,
    };
  }
}

export function classifyPorcelainStatus(stdout = '') {
  const tracked_changes = [];
  const local_only_untracked = [];
  const other_untracked = [];

  for (const rawLine of String(stdout).split('\n')) {
    if (!rawLine.trim()) continue;
    const status = rawLine.slice(0, 2);
    const rawPath = rawLine.slice(3).trim();
    const filePath = normalizeStatusPath(rawPath);
    if (!filePath) continue;

    if (status === '??') {
      if (isLocalOnlyPath(filePath)) local_only_untracked.push(filePath);
      else other_untracked.push(filePath);
      continue;
    }

    tracked_changes.push(filePath);
  }

  const dirty_paths = [...tracked_changes, ...other_untracked];
  if (dirty_paths.length > 0) {
    return {
      status: 'commit_needed',
      tracked_changes,
      local_only_untracked,
      other_untracked,
      dirty_paths,
      summary: `${dirty_paths.length} commit-required path(s), ${local_only_untracked.length} local-only path(s)`,
      commit_required: true,
    };
  }

  if (local_only_untracked.length > 0) {
    return {
      status: 'local_only',
      tracked_changes,
      local_only_untracked,
      other_untracked,
      dirty_paths,
      summary: `local-only untracked paths: ${local_only_untracked.length}`,
      commit_required: false,
    };
  }

  return {
    status: 'clean',
    tracked_changes,
    local_only_untracked,
    other_untracked,
    dirty_paths,
    summary: 'clean',
    commit_required: false,
  };
}

export function formatCommitStatusForCard(commitStatus) {
  if (!commitStatus || commitStatus.status === 'unknown') {
    return commitStatus?.summary ?? 'unknown';
  }
  if (commitStatus.status === 'commit_needed') {
    return `commit_needed (${commitStatus.summary})`;
  }
  if (commitStatus.status === 'local_only') {
    return `local_only (${commitStatus.summary})`;
  }
  return 'clean';
}

function normalizeStatusPath(rawPath) {
  const value = String(rawPath ?? '').trim();
  if (!value) return '';
  const renamed = value.match(/^(.+)\s+->\s+(.+)$/);
  return stripQuotes(renamed ? renamed[2] : value);
}

function stripQuotes(value) {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function isLocalOnlyPath(filePath) {
  return LOCAL_ONLY_PREFIXES.some((prefix) => filePath === prefix.slice(0, -1) || filePath.startsWith(prefix));
}
