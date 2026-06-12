// POK-308 — extracted from scripts/pokit-runner.mjs
// Owns gate-pass orchestration: parseBoolFlagValue, parseMetricsArgs, runGatePassCommand.
// todayUtcDateRunner() stays in pokit-runner.mjs; this module receives date as a parameter.

import { parseAgentUsage } from './agent-usage-capture.mjs';
import { extractSubagentsForMetrics } from './claude-workflow-evidence-bridge.mjs';
import { loadSkillExecutionCheckpointMap } from './event-log.mjs';
import { readAfterGatePassEvents } from './after-gate-pass-natural-hook.mjs';
import { assertFreshVerificationBeforeGate } from './safe-step-policy.mjs';
import { emitAfterGatePassHook } from './hook-emit.mjs';
import {
  resolveGatePassMetricsOptions,
  recordIssueCompletionMetrics,
} from './gate-pass-metrics.mjs';
import { assertIssueId, isIssueId } from './issue-id.mjs';
import { releaseLock } from './worktree-locks.mjs';
import { maybeBuildRepeatRuleCard } from './feedback-card.mjs';
import { readCurrentFailureContext, clearFailureContext } from './failure-context.mjs';

// POK-205: honest boolean-flag parsing. A boolean metric flag consumes an explicit
// value when a boolean-like token follows it (true/false/1/0); a bare `--flag` stays
// true for backward compatibility. This stops `--flag 0` from being recorded as true.
export function parseBoolFlagValue(next) {
  if (next === undefined || next === null) return { value: true, consumed: false };
  const token = String(next).trim().toLowerCase();
  if (token === 'true' || token === '1') return { value: true, consumed: true };
  if (token === 'false' || token === '0') return { value: false, consumed: true };
  // Not a boolean-like token (e.g. the next flag) → treat as a bare presence flag.
  return { value: true, consumed: false };
}

export function parseMetricsArgs(args) {
  const issueId = args[1];
  const options = { issueId };
  const pairs = {
    '--date': 'date',
    '--started-at': 'startedAt',
    '--ended-at': 'endedAt',
    '--session-count': 'sessionCount',
    '--changed-files': 'changedFiles',
    '--changed-lines': 'changedLines',
    '--subagent-count': 'subagentCount',
    '--ac-total': 'acTotal',
    '--ac-passed': 'acPassed',
    '--rework-count': 'reworkCount',
    '--gate-reopen-count': 'gateReopenCount',
    '--input-tokens': 'inputTokens',
    '--output-tokens': 'outputTokens',
    '--total-tokens': 'totalTokens',
    '--startup-token-count': 'startupTokenCount',
    '--work-read-token-count': 'workReadTokenCount',
    '--total-session-input': 'totalSessionInput',
    '--verification-full-suite-runs': 'verificationFullSuiteRuns',
    '--verification-duration-ms': 'verificationDurationMs',
    // POK-327 — 기록된 검증 실패 횟수 (명시 플래그 > failure_context 유래 > 0).
    '--verification-failures': 'verificationFailures',
    // POK-230 (AC3) — explicit main-session token feed. When present we mark
    // mainTokensCollected=true (see post-loop). Absent → default 0 / false (미수집).
    '--main-tokens': 'mainTotalTokens',
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    // POK-206 — non-destructive preview: compute metrics but never write metrics.json
    // or consume the marker. Pure presence flag (no value).
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--test-fail-before-commit') {
      const parsed = parseBoolFlagValue(args[index + 1]);
      options.testFailBeforeCommit = parsed.value;
      if (parsed.consumed) index += 1;
      continue;
    }
    if (arg === '--afr-triggered') {
      const parsed = parseBoolFlagValue(args[index + 1]);
      options.afrTriggered = parsed.value;
      if (parsed.consumed) index += 1;
      continue;
    }
    // POK-199: --subagents accepts a JSON string → array of per-agent attribution objects.
    // Invalid JSON is silently dropped (no crash) — orchestrator must provide valid JSON.
    if (arg === '--subagents') {
      const raw = args[index + 1];
      index += 1;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) options.subagents = parsed;
      } catch {
        // invalid JSON → leave subagents unset (미수집)
      }
      continue;
    }
    // POK-230 (AC2) — --agent-usage accepts a JSON ARRAY of raw Claude Code
    // Agent/Task usage notification entries. We run it through W1's parseAgentUsage
    // to ASSEMBLE the subagents[] array, so the orchestrator passes raw usage and
    // the runner composes the metrics shape (no hand-typed --subagents). Invalid
    // JSON is silently dropped (미수집). Additive: --subagents still works.
    if (arg === '--agent-usage') {
      const raw = args[index + 1];
      index += 1;
      try {
        const parsed = JSON.parse(raw);
        const assembled = parseAgentUsage(parsed);
        if (assembled.length > 0) options.subagents = assembled;
      } catch {
        // invalid JSON → leave subagents unset (미수집)
      }
      continue;
    }
    // POK-230 (AC1/AC2) — --workflow-result accepts a JSON workflowResult object
    // (the Claude Workflow path). We run it through W1's extractSubagentsForMetrics
    // bridge helper to assemble subagents[]. Same honest-fallback semantics.
    if (arg === '--workflow-result') {
      const raw = args[index + 1];
      index += 1;
      try {
        const parsed = JSON.parse(raw);
        const { subagents } = extractSubagentsForMetrics(parsed);
        if (Array.isArray(subagents) && subagents.length > 0) options.subagents = subagents;
      } catch {
        // invalid JSON → leave subagents unset (미수집)
      }
      continue;
    }
    const key = pairs[arg];
    if (key) {
      options[key] = args[index + 1];
      index += 1;
    }
  }

  // POK-230 (AC3) — an explicit --main-tokens feed means a real measurement:
  // mark collected=true. Absence → mainTotalTokens stays undefined and
  // recordIssueMetrics defaults to 0 / collected=false (미수집). We never set
  // collected=true without a value (no fake 0-as-real).
  if (options.mainTotalTokens !== undefined) {
    options.mainTokensCollected = true;
  }

  return options;
}

export async function runGatePassCommand(args, { root = process.cwd(), stdout = process.stdout, stderr = process.stderr, runGit, date } = {}) {
  const issueId = args[1];
  if (!isIssueId(issueId)) {
    stderr.write(`error: gate-pass requires issue id (got: ${issueId ?? '<missing>'})\n`);
    return { ok: false, reason: 'invalid_issue_id' };
  }
  const normalizedIssueId = assertIssueId(issueId);

  const metricsOptions = parseMetricsArgs(args);
  metricsOptions.issueId = normalizedIssueId;
  const dryRun = metricsOptions.dryRun === true;

  // POK-247 (AC7, FRG-001) — gate_passed must NOT be auto-produced without independent
  // verification evidence. Require a pre-existing verification_ready checkpoint, emitted
  // by the real verification path (pokit-issue Step 5 / skill-checkpoint CLI) BEFORE
  // gate-pass. Block (no hook, no metrics, no state) when it is absent. Skipped on
  // dry-run (pure preview, no writes).
  //
  // This SUPERSEDES the POK-228 gate-pass self-emit of verification_ready: gate-pass no
  // longer emits its own "verification passed" checkpoint (that self-certification was
  // the evidence-free-completion hole). The checkpoint is now guaranteed by REFUSAL —
  // gate-pass refuses without it — which is strictly stronger than self-emission and the
  // chain ordering (verification_ready strictly before after_gate_pass) stays clean.
  if (!dryRun) {
    const checkpointMap = await loadSkillExecutionCheckpointMap(root);
    const receipts = checkpointMap.get(normalizedIssueId) ?? [];
    let afterGatePassEvents = [];
    try {
      const allGateEvents = await readAfterGatePassEvents({ root });
      afterGatePassEvents = allGateEvents.filter(
        (event) => String(event.issue_id ?? '').toUpperCase() === normalizedIssueId
      );
    } catch {
      afterGatePassEvents = [];
    }
    const verification = assertFreshVerificationBeforeGate({ receipts, afterGatePassEvents });
    if (!verification.ok) {
      const detail = verification.reason === 'verification_evidence_stale'
        ? `${normalizedIssueId}'s verification_ready predates its last gate-pass (stale — re-run verification after the rework)`
        : `${normalizedIssueId} has no independent verification_ready checkpoint`;
      stderr.write(
        `error: ${verification.reason} — ${detail}. ` +
          `Run verification (focused tests + doctor + git diff --check) and emit it before gate-pass:\n` +
          `  node scripts/pokit-skill-checkpoint.mjs --issue ${normalizedIssueId} --step verification_ready --summary "<outcome>"\n` +
          `gate-pass does not self-certify verification (POK-247/FRG-001).\n`
      );
      return { ok: false, reason: verification.reason };
    }
  }

  // POK-327 — failure_context → 메트릭: 이 이슈로 기록된 검증 실패 횟수를 정직값으로 옮긴다.
  // 명시 플래그가 항상 우선 (POK-325 의미론). 다른 이슈의 기록은 건드리지 않는다.
  // 읽기 실패는 미수집(0)으로 — 완료 흐름을 막지 않는다.
  if (metricsOptions.verificationFailures === undefined) {
    const failureContext = await readCurrentFailureContext({ root });
    if (failureContext && failureContext.issue === normalizedIssueId) {
      metricsOptions.verificationFailures = failureContext.attempt;
    }
  }

  // POK-206 — a dry-run is a pure preview: no gate-pass hook side effect, no write.
  const payload = dryRun ? null : emitAfterGatePassHook({ issueId: normalizedIssueId, stream: stdout });

  const resolvedMetricsOptions = await resolveGatePassMetricsOptions({
    root,
    metricsOptions,
    issueId: normalizedIssueId,
    runGit,
    date,
  });

  const metricsResult = await recordIssueCompletionMetrics({ root, ...resolvedMetricsOptions });
  if (!dryRun && process.env.POKIT_SESSION_ID) {
    try {
      await releaseLock(root, {
        kind: 'issue',
        resource: normalizedIssueId,
        holder: process.env.POKIT_SESSION_ID,
      });
    } catch (error) {
      stderr.write(`warn: issue_lock_release_skipped — ${error.message}\n`);
    }
  }

  if (
    metricsResult.metrics.duration_ms === 0 &&
    resolvedMetricsOptions.startedAt === undefined &&
    resolvedMetricsOptions.endedAt === undefined
  ) {
    stderr.write(
      'warn: metrics_duration_zero — duration_ms is 0 (측정 안 함): no start time was captured or derivable. A real run captures wall-clock via the start marker at execution-approval; 0 means the work duration was not measured.\n'
    );
  }

  stdout.write(`${JSON.stringify(dryRun ? { dryRun: true, ...metricsResult } : metricsResult)}\n`);

  // POK-327 — 통과 확정 후 이 이슈의 failure_context 를 none 으로 초기화한다
  // (시도 횟수는 위에서 메트릭에 보존됨). 실패해도 완료 흐름을 막지 않는다.
  if (!dryRun) {
    try {
      await clearFailureContext({ root, issueId: normalizedIssueId });
    } catch {
      // 초기화 실패는 다음 세션 doctor/수동 정리로 회복 가능 — 완료 흐름 우선.
    }
  }

  // POK-326 — 동일 prevention-rule이 이번 스프린트에 2회 이상 반복됐을 때만,
  // 완료 확인 직후 사용자 피드백 카드를 띄운다 (1회는 침묵 — 과알림 방지).
  // maybeBuildRepeatRuleCard는 어떤 오류도 던지지 않는다 — 카드가 완료 흐름을 막지 않는다.
  let feedbackCard = null;
  if (!dryRun) {
    feedbackCard = await maybeBuildRepeatRuleCard({ root });
    if (feedbackCard) stdout.write(`${feedbackCard}\n`);
  }

  return { ok: true, dryRun, payload, metrics: metricsResult, feedbackCard };
}
