// POK-325 — transition-time issue card status sync.
//
// pokit-next updates the three state surfaces (current.md / status-board.md /
// handoff.md) but the target issue card's frontmatter `status:` used to be a
// manual edit — when forgotten, pokit-issue-preflight blocks execution with a
// status mismatch. This module is the script chokepoint that performs that card
// mutation, invoked via `node scripts/pokit-runner.mjs transition-status <POK-XXX>`.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveActiveIssuePath } from './issue-paths.mjs';
import { assertIssueId } from './issue-id.mjs';

// POK-036 six-value status enum (issue card frontmatter SSoT).
export const ISSUE_STATUS_VALUES = Object.freeze([
  'candidate',
  'accepted',
  'pending',
  'in_progress',
  'gate_passed',
  'deferred',
]);

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Update the frontmatter `status:` (and `updated_at:`) of an existing issue card.
 * Returns { ok, issuePath, previousStatus, status } or { ok: false, reason }.
 */
export async function syncIssueCardStatus({
  root = process.cwd(),
  issueId,
  status = 'in_progress',
  updatedAt = todayUtcDate(),
} = {}) {
  const normalizedIssueId = assertIssueId(issueId);
  if (!ISSUE_STATUS_VALUES.includes(status)) {
    return { ok: false, reason: 'invalid_status', allowed: ISSUE_STATUS_VALUES };
  }

  let issuePath;
  try {
    issuePath = await resolveActiveIssuePath(root, normalizedIssueId);
  } catch {
    return { ok: false, reason: 'issue_card_not_found', issueId: normalizedIssueId };
  }

  const fullPath = path.join(root, issuePath);
  let text;
  try {
    text = await readFile(fullPath, 'utf8');
  } catch {
    return { ok: false, reason: 'issue_card_not_found', issueId: normalizedIssueId };
  }

  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { ok: false, reason: 'frontmatter_missing', issuePath };
  }

  const frontmatter = frontmatterMatch[1];
  const statusLine = frontmatter.match(/^status:\s*(.*)$/m);
  if (!statusLine) {
    return { ok: false, reason: 'status_field_missing', issuePath };
  }
  const previousStatus = statusLine[1].trim();

  let nextFrontmatter = frontmatter.replace(/^status:\s*.*$/m, `status: ${status}`);
  if (/^updated_at:\s*.*$/m.test(nextFrontmatter)) {
    nextFrontmatter = nextFrontmatter.replace(/^updated_at:\s*.*$/m, `updated_at: ${updatedAt}`);
  }

  if (nextFrontmatter !== frontmatter) {
    const nextText =
      text.slice(0, frontmatterMatch.index) +
      `---\n${nextFrontmatter}\n---` +
      text.slice(frontmatterMatch.index + frontmatterMatch[0].length);
    await writeFile(fullPath, nextText, 'utf8');
  }

  return {
    ok: true,
    issueId: normalizedIssueId,
    issuePath,
    previousStatus,
    status,
    changed: previousStatus !== status,
  };
}

/**
 * CLI adapter for the runner `transition-status` subcommand.
 * Usage: transition-status <POK-XXX> [--status in_progress]
 */
export async function runTransitionStatusCommand(args, { root = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const issueId = args[1];
  let status = 'in_progress';
  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === '--status' && args[index + 1] !== undefined) {
      status = args[index + 1];
      index += 1;
    }
  }

  let result;
  try {
    result = await syncIssueCardStatus({ root, issueId, status });
  } catch (error) {
    stderr.write(`error: transition_status_failed — ${error.message}\n`);
    return { ok: false, reason: 'invalid_issue_id' };
  }

  if (!result.ok) {
    stderr.write(`error: transition_status_failed — ${result.reason}\n`);
    return result;
  }

  stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
