import { assertIssueId, isIssueId } from './issue-id.mjs';

export const HOOK_SCHEMA_VERSION = '0.1.0';
export const EVENT_NAME = 'after_gate_pass';

export function detectProvider({ env = process.env } = {}) {
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return 'claude_code';
  if (env.CODEX_ENV || env.CODEX_SESSION_ID) return 'codex';
  if (env.ANTIGRAVITY || env.ANTIGRAVITY_SESSION) return 'antigravity';
  return 'unknown';
}

export function buildAfterGatePassPayload({ issueId, env, now } = {}) {
  if (!isIssueId(issueId)) {
    throw new Error(`Invalid POKit issue id for hook emit: ${issueId}`);
  }
  const normalizedIssueId = assertIssueId(issueId);
  const emittedAt = now ? new Date(now).toISOString() : new Date().toISOString();
  return {
    schema_version: HOOK_SCHEMA_VERSION,
    event_name: EVENT_NAME,
    emitted_at: emittedAt,
    provider: detectProvider({ env }),
    issue_id: normalizedIssueId,
    gate_state: 'gate_passed',
    status: 'gate_passed',
  };
}

export function emitAfterGatePassHook({ issueId, env, now, silent = false, stream = process.stdout } = {}) {
  const payload = buildAfterGatePassPayload({ issueId, env, now });
  if (!silent) {
    stream.write(`${JSON.stringify(payload)}\n`);
  }
  return payload;
}
