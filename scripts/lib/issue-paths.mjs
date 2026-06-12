// POK-066 Physical Migration — Issue Path Resolver
// New path takes precedence; legacy .ai-os path is the fallback for user-project compatibility.

import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isIssueFileName } from './issue-id.mjs';

export const NEW_ISSUES_DIR = 'projects/pokit/issues';
export const LEGACY_ISSUES_DIR = '.ai-os';
export { ISSUE_FILE_PATTERN } from './issue-id.mjs';

// Returns { dir, files } — tries new path first, falls back to legacy.
// dir is a relative path string (no leading slash).
export async function listIssueFiles(root) {
  const newDir = path.join(root, NEW_ISSUES_DIR);
  try {
    const entries = await readdir(newDir);
    const files = entries.filter((n) => isIssueFileName(n));
    if (files.length > 0) return { dir: NEW_ISSUES_DIR, files };
  } catch {}

  try {
    const entries = await readdir(path.join(root, LEGACY_ISSUES_DIR));
    const files = entries.filter((n) => isIssueFileName(n));
    return { dir: LEGACY_ISSUES_DIR, files };
  } catch {}

  return { dir: NEW_ISSUES_DIR, files: [] };
}

// Resolves the relative file path for a given issue ID.
// Tries new path first; falls back to legacy if new path does not exist.
export async function resolveActiveIssuePath(root, issueId) {
  if (!issueId) return null;
  const newPath = path.join(root, NEW_ISSUES_DIR, `${issueId}.md`);
  try {
    await access(newPath);
    return `${NEW_ISSUES_DIR}/${issueId}.md`;
  } catch {}
  return `${LEGACY_ISSUES_DIR}/${issueId}.md`;
}
