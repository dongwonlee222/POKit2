#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — block direct issue card writes.
 *
 * Deny Write/Edit to NEW issue card paths and Bash commands that obviously
 * redirect/copy to a new issue card path. Existing-file edits are allowed.
 *
 * ALLOW = exit 0, no output (or allow JSON)
 * DENY  = print hookSpecificOutput JSON to stdout, exit 0
 *
 * Conservative Bash pattern: only matches obvious literal redirection/copy/mv/tee/install
 * targeting projects/.../issues/POK-*.md. Interpreter writes (node -e '...') are NOT
 * matched here — they are caught by the doctor check (checkIssueAuthoringEvidence).
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';

// POK-258: 정확 패턴 SSoT 통일 예정(여기선 prefix-agnostic 인라인)
// 이슈 ID prefix-agnostic: POK-, GG-, MODU-, COM- 등 [A-Z][A-Z0-9]*-\d+ 형식 모두 매칭
const ISSUE_CARD_PATH_RE = /projects\/[^/]+\/issues\/[A-Z][A-Z0-9]*-\d+\.md$/;

// Conservative bash pattern: redirect (> / >>), tee, cp, mv, install
// targeting a literal path ending in projects/.../issues/<PREFIX>-NNN.md
// POK-258: 정확 패턴 SSoT 통일 예정(여기선 prefix-agnostic 인라인)
const BASH_WRITE_RE =
  /(>>?|tee|cp|mv|install)\s+[^|;&]*projects\/[^/]+\/issues\/[A-Z][A-Z0-9]*-\d+\.md/;

const DENY_REASON =
  '이슈 카드는 직접 생성할 수 없습니다. node scripts/pokit-issue-create.mjs 로 만드세요 (영수증이 함께 발행돼야 추적됩니다).';

function allow() {
  return { decision: 'allow' };
}

function deny(reason = DENY_REASON) {
  return { decision: 'deny', reason };
}

/**
 * Core decision function — exported for unit testing.
 *
 * @param {object} payload - parsed PreToolUse JSON payload
 * @returns {{ decision: 'allow'|'deny', reason?: string }}
 */
export function decide(payload) {
  if (!payload || typeof payload !== 'object') return allow();

  const toolName = payload.tool_name ?? '';
  const toolInput = payload.tool_input ?? {};

  if (toolName === 'Write' || toolName === 'Edit') {
    const fp = toolInput.file_path ?? '';
    if (ISSUE_CARD_PATH_RE.test(fp)) {
      // Will be checked async in main(); for sync decide(), assume new file = deny.
      // Callers that can do async checks should use decideAsync() instead.
      return deny();
    }
    return allow();
  }

  if (toolName === 'Bash') {
    const cmd = toolInput.command ?? '';
    if (BASH_WRITE_RE.test(cmd)) {
      return deny();
    }
    return allow();
  }

  return allow();
}

/**
 * Async version of decide — for Write/Edit, checks disk existence to allow
 * edits to already-existing cards.
 */
export async function decideAsync(payload) {
  if (!payload || typeof payload !== 'object') return allow();

  const toolName = payload.tool_name ?? '';
  const toolInput = payload.tool_input ?? {};

  if (toolName === 'Write' || toolName === 'Edit') {
    const fp = toolInput.file_path ?? '';
    if (!ISSUE_CARD_PATH_RE.test(fp)) return allow();

    // Allow edits to files that already exist on disk.
    // Resolve relative paths against CWD so an existing card isn't false-denied
    // when the hook's CWD differs from where file_path was expressed.
    const absFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
    try {
      await stat(absFp);
      return allow(); // File exists — editing is allowed
    } catch (err) {
      if (err?.code === 'ENOENT') return deny(); // New file — deny
      // Other errors: allow (don't crash user flow)
      return allow();
    }
  }

  if (toolName === 'Bash') {
    const cmd = toolInput.command ?? '';
    if (BASH_WRITE_RE.test(cmd)) return deny();
    return allow();
  }

  return allow();
}

function outputDeny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }) + '\n'
  );
}

function outputAllow() {
  // IMPORTANT: emit NOTHING on allow. A PreToolUse hook that prints
  // permissionDecision:"allow" BYPASSES Claude Code's normal permission system
  // and auto-approves the tool. Since this hook matches every Write/Edit/Bash,
  // that would silently disable the user's approval prompts for all of them.
  // Exit 0 with no output → normal permission flow proceeds unchanged.
}

async function main() {
  let raw = '';
  try {
    // Read stdin (may be empty in some test invocations)
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch {
    // stdin error — allow
    outputAllow();
    return;
  }

  if (!raw.trim()) {
    outputAllow();
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Unparseable stdin — allow (never crash user flow)
    outputAllow();
    return;
  }

  let result;
  try {
    result = await decideAsync(payload);
  } catch {
    outputAllow();
    return;
  }

  if (result.decision === 'deny') {
    outputDeny(result.reason ?? DENY_REASON);
  } else {
    outputAllow();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
