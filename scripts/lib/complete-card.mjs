// POK-307 — extracted from scripts/pokit-runner.mjs
// Owns the ✅ Complete lifecycle card: field-builder + runner subcommand.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertIssueId, isIssueId } from './issue-id.mjs';
import { resolveActiveIssuePath } from './issue-paths.mjs';
import { classifyCommitStatus, formatCommitStatusForCard } from './commit-status.mjs';
import { loadSkillExecutionCheckpointMap } from './event-log.mjs';
import { issueMetricsPath } from './issue-metrics.mjs';
import { renderCompleteCard } from './lifecycle-card-renderer.mjs';

// ---------------------------------------------------------------------------
// Internal helper — minimal frontmatter reader that supports scalar and list
// values (needed for `produces`). Not exported; use the injected arg when
// testing or call resolveIssuePath externally.
// ---------------------------------------------------------------------------
function _parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result = {};
  let pendingKey = null;
  for (const line of match[1].split('\n')) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      pendingKey = keyValue[1];
      const trimmed = keyValue[2].trim();
      result[pendingKey] = trimmed === '' ? true : trimmed === 'null' ? null : trimmed.replace(/^['"]|['"]$/g, '');
      continue;
    }
    const listValue = line.match(/^\s*-\s*(.+)$/);
    if (listValue && pendingKey) {
      if (!Array.isArray(result[pendingKey])) result[pendingKey] = [];
      const trimmed = listValue[1].trim();
      result[pendingKey].push(trimmed.replace(/^['"]|['"]$/g, ''));
    }
  }
  return result;
}

async function _readIssueFrontmatter(root, issuePath) {
  try {
    const text = await readFile(path.join(root, issuePath), 'utf8');
    return _parseFrontmatter(text);
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

function _todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// POK-271 (AC1, AC2) — build the fields object for the ✅ Complete lifecycle card.
// Does NOT claim gate_passed by itself; it reads gate_state from the issue frontmatter
// and surfaces verification_ready vs gate_passed as distinct states. No side effects.
// ---------------------------------------------------------------------------
export function buildCompleteCardFields({
  issueId = null,
  gateState = 'pending',
  issueFm = {},
  verificationCheckpoint = null,
  metricsPath = null,
  metricsData = null,
  commitStatus = null,
} = {}) {
  // AC2 gate_state distinction: reflect the real gate_state; never call verification_ready → gate_passed.
  const stateLabel = gateState === 'gate_passed'
    ? 'gate_passed'
    : 'verification_ready / 게이트 대기';

  // Pull tests/doctor/diff summary from the verification_ready checkpoint payload when available.
  const verPayload = verificationCheckpoint?.payload ?? {};
  const verSummary = verificationCheckpoint?.summary ?? verPayload.summary ?? null;
  const verifiedAt = verificationCheckpoint?.emitted_at ?? null;

  // Extract test/doctor/diff lines from summary text (best-effort; use fallback when absent).
  let tests = '-';
  let doctor = '-';
  let diff = '-';
  if (verSummary) {
    const testMatch = verSummary.match(/tests?\s*[:\→>]\s*([^\n;,]+)/i);
    const doctorMatch = verSummary.match(/doctor\s*[:\→>]\s*([^\n;,]+)/i);
    const diffMatch = verSummary.match(/diff\s*[:\→>]\s*([^\n;,]+)/i);
    const fullSuiteMatch = verSummary.match(/full suite\s+([^;]+)/i);
    const doctorPlainMatch = verSummary.match(/doctor\s+([^;]+)/i);
    const gitDiffMatch = verSummary.match(/git diff --check\s+([^;]+)/i);
    if (testMatch) tests = testMatch[1].trim();
    else if (fullSuiteMatch) tests = `full suite ${fullSuiteMatch[1].trim()}`;
    if (doctorMatch) doctor = doctorMatch[1].trim();
    else if (doctorPlainMatch) doctor = doctorPlainMatch[1].trim();
    if (diffMatch) diff = diffMatch[1].trim();
    else if (gitDiffMatch) diff = `git diff --check ${gitDiffMatch[1].trim()}`;
  }

  // Supplement from metrics when available (AC2: pull token/test counts when present).
  if (metricsData?.ac_passed !== undefined && metricsData?.ac_total !== undefined) {
    tests = `AC ${metricsData.ac_passed}/${metricsData.ac_total} pass${tests !== '-' ? ` (${tests})` : ''}`;
  }

  const changes = issueFm.produces
    ? (Array.isArray(issueFm.produces) ? issueFm.produces.join(', ') : String(issueFm.produces))
    : (issueFm.title ?? '-');

  return {
    card_type: 'complete',
    title: '✅ POKit2 작업 완료',
    display_only: true,
    approves_gate_pass: false,
    fields: {
      result: {
        issue: issueId,
        state: stateLabel,
        completed_at: verifiedAt ?? null,
      },
      changes: {
        summary: changes,
      },
      verification: {
        tests,
        doctor,
        diff,
        ...(commitStatus ? { commit: formatCommitStatusForCard(commitStatus) } : {}),
        ...(metricsPath ? { evidence_path: metricsPath } : {}),
        ...(verifiedAt ? { verified_at: verifiedAt } : {}),
      },
      next: {
        action: gateState === 'gate_passed'
          ? '"진행해줘" → /pokit.next 로 다음 후보 전환.'
          : '게이트 통과 후 "/pokit.next" 로 전환. 게이트 클레임은 별도 human 확인 필요.',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// POK-271 (AC1) — runner-owned complete subcommand.
// Usage: node scripts/pokit-runner.mjs complete POK-XXX
// Gathers issue state + verification_ready checkpoint + metrics.json → renders ✅ Complete card.
// Does NOT claim gate_passed, does NOT write .ai-os state files.
// ---------------------------------------------------------------------------
export async function runCompleteCommand(
  args,
  {
    root = process.cwd(),
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  const issueId = args[1];
  if (!isIssueId(issueId)) {
    stderr.write(`error: complete requires issue id (got: ${issueId ?? '<missing>'})\n`);
    return { ok: false, reason: 'invalid_issue_id' };
  }
  const normalizedIssueId = assertIssueId(issueId);

  // Read issue frontmatter for gate_state.
  let issueFm = {};
  try {
    const issuePath = await resolveActiveIssuePath(root, normalizedIssueId);
    issueFm = await _readIssueFrontmatter(root, issuePath);
  } catch {
    // Missing issue is non-fatal; card shows fallback values.
  }

  const gateState = issueFm.gate_state ?? 'pending';

  // Load the most recent verification_ready checkpoint for this issue (AC2).
  let verificationCheckpoint = null;
  try {
    const checkpointMap = await loadSkillExecutionCheckpointMap(root);
    const receipts = (checkpointMap.get(normalizedIssueId) ?? []).filter((r) => r.step === 'verification_ready');
    if (receipts.length > 0) verificationCheckpoint = receipts[receipts.length - 1];
  } catch {
    // Non-fatal; card shows fallback values.
  }

  // Try to read metrics.json (AC2: pull evidence path + token/test counts when available).
  const metricsDate = _todayUtcDate();
  const mPath = issueMetricsPath(metricsDate, normalizedIssueId);
  let metricsData = null;
  let resolvedMetricsPath = null;
  try {
    const metricsText = await readFile(path.join(root, mPath), 'utf8');
    metricsData = JSON.parse(metricsText);
    resolvedMetricsPath = mPath;
  } catch {
    // Non-fatal; metrics not yet recorded is normal before gate-pass.
  }

  const completeCard = buildCompleteCardFields({
    issueId: normalizedIssueId,
    gateState,
    issueFm,
    verificationCheckpoint,
    metricsPath: resolvedMetricsPath,
    metricsData,
    commitStatus: await classifyCommitStatus({ root }),
  });

  const now = verificationCheckpoint?.emitted_at ? new Date(verificationCheckpoint.emitted_at) : new Date();
  const renderedCompleteLifecycleCard = renderCompleteCard({ completeCard, now });

  const output = {
    completeCard,
    renderedCompleteLifecycleCard,
  };
  stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  return { ok: true, completeCard, renderedCompleteLifecycleCard };
}
