#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook — auto-reissue issue_authored after card edits (POK-325).
 *
 * Definition changes (title edits) break the issue_authored content hash, which
 * previously required a manual re-emission before doctor passed. Every issue-card
 * edit flows through this chokepoint: after a successful Write/Edit to an existing
 * card, recompute the hash and append a fresh receipt ONLY when none matches
 * (reissueIssueAuthoredReceipt is an idempotent no-op when the receipt is current).
 *
 * Fail-open by design: this hook must never break the user's edit flow — any
 * error exits 0 silently. It also never creates cards; missing files are skipped.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reissueIssueAuthoredReceipt } from '../lib/issue-create.mjs';

// Same prefix-agnostic card-path shape as block-issue-card-write.mjs (POK-258 SSoT 예정).
const ISSUE_CARD_PATH_RE = /projects\/[^/]+\/issues\/[A-Z][A-Z0-9]*-\d+\.md$/;

export async function handlePostToolUse(payload, { root = process.cwd() } = {}) {
  if (!payload || typeof payload !== 'object') return { handled: false, reason: 'no_payload' };

  const toolName = payload.tool_name ?? '';
  if (toolName !== 'Write' && toolName !== 'Edit') return { handled: false, reason: 'tool_not_card_write' };

  const filePath = payload.tool_input?.file_path ?? '';
  if (!ISSUE_CARD_PATH_RE.test(filePath)) return { handled: false, reason: 'not_issue_card' };

  const cardPath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const result = await reissueIssueAuthoredReceipt({ root, cardPath });
  return { handled: true, ...result };
}

async function main() {
  let raw = '';
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch {
    return;
  }
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  try {
    await handlePostToolUse(payload, { root: process.cwd() });
  } catch {
    // Fail-open: never block or crash the edit flow.
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
