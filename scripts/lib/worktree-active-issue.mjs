import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ACTIVE_ISSUE_CONFIG_KEY = 'pokit.activeIssue';

function parseCurrentMdActiveIssue(text) {
  const match = String(text ?? '').match(/^\s*active_issue:\s*(\S+)\s*$/m);
  return match ? match[1].trim() : null;
}

function runGit(root, args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });
}

async function hasGitMetadata(root) {
  try {
    await stat(path.join(root, '.git'));
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

function readWorktreeConfig(root) {
  const result = runGit(root, ['config', '--worktree', '--get', ACTIVE_ISSUE_CONFIG_KEY]);
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return /^POK-\d{3}$/.test(value) ? value : null;
}

export async function readActiveIssueForWorktree(root) {
  if (await hasGitMetadata(root)) {
    const configured = readWorktreeConfig(root);
    if (configured) {
      return {
        activeIssue: configured,
        source: 'git-config-worktree',
      };
    }
  }

  try {
    const currentText = await readFile(path.join(root, '.ai-os/current.md'), 'utf8');
    return {
      activeIssue: parseCurrentMdActiveIssue(currentText),
      source: 'current.md',
    };
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return { activeIssue: null, source: 'none' };
    }
    throw err;
  }
}

export async function writeActiveIssueForWorktree(root, issueId) {
  if (!/^POK-\d{3}$/.test(String(issueId ?? ''))) {
    throw new Error('issueId must look like POK-260');
  }
  const enable = runGit(root, ['config', 'extensions.worktreeConfig', 'true']);
  if (enable.status !== 0) {
    throw new Error((enable.stderr || enable.stdout || 'failed to enable worktree config').trim());
  }
  const write = runGit(root, ['config', '--worktree', ACTIVE_ISSUE_CONFIG_KEY, issueId]);
  if (write.status !== 0) {
    throw new Error((write.stderr || write.stdout || 'failed to write worktree active issue').trim());
  }
  return {
    activeIssue: issueId,
    source: 'git-config-worktree',
  };
}
