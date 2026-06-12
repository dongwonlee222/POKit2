import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { deriveIssueDurationFromCard } from './issue-duration.mjs';

export const ISSUE_METRICS_SCHEMA_VERSION = '0.5.0';

// POK-230 (AC4) — `duration_ms` is ELAPSED wall-clock time (started_at → ended_at),
// INCLUDING any trailing human wait (approval/idle) that fell between the last
// durable change and the moment the record was written. Callers that can supply a
// last-change/verification timestamp SHOULD pass it as `endedAt` to exclude that
// trailing wait; otherwise ended_at falls back to Date.now() at record time.
export const DURATION_MS_SEMANTICS = 'elapsed';

// Layer A metric keys.
//
// NOTE (POK-141): input_tokens / output_tokens / total_tokens are OPTIONAL.
// We keep them in the schema for backwards compatibility, but doctor no
// longer warns when all three are 0. There is no harvest implementation
// yet — values default to 0 and can be set manually via pokit-runner flags.
// A dedicated harvest path may land in a follow-up issue (YAGNI for now).
//
// POK-199 — per-agent token attribution (D1/D2/D3 honesty conventions):
//   - `subagents` is an ADDITIVE array field; legacy records without it are valid.
//   - total_tokens === 0 ⟺ 미수집 (unmeasured); real work always uses tokens (D2).
//   - Per-agent input_tokens/output_tokens are NOT recorded — platform exposes
//     only per-agent totals (their absence IS the honest "미수집" signal).
//   - main-session tokens are out of scope = 미수집 (D3).
//
// POK-230 (v0.4.0) — main-session token honesty (AC3):
//   - `main_total_tokens` (nonNegativeInteger, default 0) + `main_tokens_collected`
//     (boolean, default false). false ⟺ 미수집 (no runtime affordance exposes the
//     main session's own token usage today); true + value ⟺ a real measurement.
//   - We never store a Korean string in an integer field; the boolean carries the
//     "미수집" signal. Use formatMainTokens() to render it ("미수집" vs the number).
//   All new keys are ADDITIVE: legacy 0.3.0 records (without them) still load and
//   validate — missing = 0 / false / 미수집.
const METRIC_KEYS = Object.freeze([
  'schema_version',
  'duration_ms',
  // POK-206 — persist the resolved wall-clock endpoints alongside duration so a
  // later re-record can reproduce the SAME duration (idempotent) and recover the
  // real start even when the start marker is gone. 0 = 측정 안 함 (unmeasured),
  // consistent with the duration_ms 0-convention (never null).
  'started_at',
  'ended_at',
  'session_count',
  'changed_files',
  'changed_lines',
  'subagent_count',
  'ac_total',
  'ac_passed',
  'rework_count',
  'test_fail_before_commit',
  'afr_triggered',
  'gate_reopen_count',
  // POK-327 (v0.5.0) — 검증 실패 기록 횟수 (failure_context 유래). 0 = 기록된 실패 없음.
  // 시도 횟수 = verification_failures + 1 (마지막 통과 시도 포함). additive — 레거시 레코드 유효.
  'verification_failures',
  // optional, harvest 미구현, 0 허용
  'input_tokens',
  'output_tokens',
  'total_tokens',
  // POK-141 (v0.3.0) — startup/work read budgets + verification efficiency
  'startup_token_count',
  'work_read_token_count',
  'total_session_input',
  'verification_full_suite_runs',
  'verification_duration_ms',
  // POK-230 (v0.4.0) — main-session token honesty (additive; default 0 / false).
  'main_total_tokens',
  'main_tokens_collected',
  // POK-199 (v0.3.0) — per-agent attribution; array of { model, worker_type, total_tokens }
  // POK-230 (v0.4.0) — entries MAY additionally carry optional duration_ms / tool_uses.
  'subagents',
]);

export function buildIssueMetrics({
  startedAt = null,
  endedAt = null,
  sessionCount = 1,
  changedFiles = 0,
  changedLines = 0,
  subagentCount = 0,
  acTotal = 0,
  acPassed = 0,
  reworkCount = 0,
  testFailBeforeCommit = false,
  afrTriggered = false,
  gateReopenCount = 0,
  verificationFailures = 0,
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
  startupTokenCount = 0,
  workReadTokenCount = 0,
  totalSessionInput = 0,
  verificationFullSuiteRuns = 1,
  verificationDurationMs = 0,
  // POK-230 (AC3): main-session token honesty. No runtime affordance exposes the
  // main session's own usage today → default = 미수집 (collected=false, value=0).
  // A real measurement sets mainTokensCollected=true with mainTotalTokens>0.
  mainTotalTokens = 0,
  mainTokensCollected = false,
  // POK-199: per-agent attribution array; each entry: { model, worker_type, total_tokens }
  // Absent or empty = no subagent data (compatible with legacy records).
  subagents = [],
} = {}) {
  // POK-199 (D2): Normalize subagents — drop malformed (non-object) entries;
  // coerce each field to a safe type. Only total_tokens is recorded per agent
  // (platform does not expose per-agent input/output → their absence = 미수집).
  // POK-230 (AC5): tolerate OPTIONAL additive duration_ms / tool_uses — pass them
  // through when present (and non-negative), drop them when absent or malformed.
  const normalizedSubagents = (Array.isArray(subagents) ? subagents : [])
    .filter((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      const normalized = {
        model: String(entry.model ?? 'unknown'),
        worker_type: String(entry.worker_type ?? 'unknown'),
        total_tokens: nonNegativeInteger(entry.total_tokens),
      };
      if (isOptionalNonNegative(entry.duration_ms)) {
        normalized.duration_ms = nonNegativeInteger(entry.duration_ms);
      }
      if (isOptionalNonNegative(entry.tool_uses)) {
        normalized.tool_uses = nonNegativeInteger(entry.tool_uses);
      }
      return normalized;
    });

  // POK-199 (AC1): total_tokens=0 means 미수집 (D2). When it is 0 AND per-agent
  // subagents are present, derive the aggregate from the subagent array (auto-capture).
  // A non-zero explicit totalTokens always wins and is never overridden. (An explicit
  // 0 with subagents present is intentionally treated as 미수집 → derives, since real
  // work with subagents cannot have a true 0 total.)
  const resolvedTotalTokens =
    nonNegativeInteger(totalTokens) === 0 && normalizedSubagents.length > 0
      ? normalizedSubagents.reduce((sum, a) => sum + a.total_tokens, 0)
      : nonNegativeInteger(totalTokens);

  // POK-206 — resolve started/ended ONCE so duration_ms and the persisted
  // started_at/ended_at are always consistent. When a real start is known but no
  // end was given, the end is "now" (real wall-clock at record time).
  const { started, ended, duration } = resolveTimes(startedAt, endedAt);

  return orderedMetrics({
    schema_version: ISSUE_METRICS_SCHEMA_VERSION,
    duration_ms: duration,
    started_at: started,
    ended_at: ended,
    session_count: nonNegativeInteger(sessionCount),
    changed_files: nonNegativeInteger(changedFiles),
    changed_lines: nonNegativeInteger(changedLines),
    subagent_count: nonNegativeInteger(subagentCount),
    ac_total: nonNegativeInteger(acTotal),
    ac_passed: nonNegativeInteger(acPassed),
    rework_count: nonNegativeInteger(reworkCount),
    test_fail_before_commit: Boolean(testFailBeforeCommit),
    afr_triggered: Boolean(afrTriggered),
    gate_reopen_count: nonNegativeInteger(gateReopenCount),
    verification_failures: nonNegativeInteger(verificationFailures),
    input_tokens: nonNegativeInteger(inputTokens),
    output_tokens: nonNegativeInteger(outputTokens),
    total_tokens: resolvedTotalTokens,
    startup_token_count: nonNegativeInteger(startupTokenCount),
    work_read_token_count: nonNegativeInteger(workReadTokenCount),
    total_session_input: nonNegativeInteger(totalSessionInput),
    verification_full_suite_runs: nonNegativeInteger(verificationFullSuiteRuns),
    verification_duration_ms: nonNegativeInteger(verificationDurationMs),
    // POK-230 (AC3) — main-session token honesty. The boolean carries the 미수집
    // signal; the integer never holds a Korean string. Use formatMainTokens() to render.
    main_total_tokens: nonNegativeInteger(mainTotalTokens),
    main_tokens_collected: Boolean(mainTokensCollected),
    subagents: normalizedSubagents,
  });
}

export function issueMetricsPath(date, issueId) {
  assertDate(date);
  assertIssueId(issueId);
  return `.ai-os/runs/${date}/${issueId}/metrics.json`;
}

export async function writeIssueMetrics({
  root = process.cwd(),
  date = todayUtcDate(),
  issueId,
  metrics = buildIssueMetrics(),
} = {}) {
  const filePath = issueMetricsPath(date, issueId);
  const fullPath = path.join(root, filePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(orderedMetrics(metrics), null, 2)}\n`, 'utf8');
  return filePath;
}

export async function recordIssueMetrics(options = {}) {
  // POK-196 — auto-derive duration from issue card frontmatter when the caller
  // did not pass startedAt / endedAt explicitly. Explicit values always win
  // (AC3): derivation only runs when BOTH are nullish.
  let { startedAt, endedAt } = options;
  if ((startedAt === null || startedAt === undefined) &&
      (endedAt === null || endedAt === undefined) &&
      options.issueId) {
    const derived = await deriveIssueDurationFromCard(
      options.root ?? process.cwd(),
      options.issueId
    );
    // AC4: if card is missing or has no parseable dates, derived returns nulls
    // → leave startedAt/endedAt as-is so duration stays 0 (no false backfill).
    if (derived.startedAt) startedAt = derived.startedAt;
    if (derived.endedAt) endedAt = derived.endedAt;
  }

  const metrics = buildIssueMetrics({ ...options, startedAt, endedAt });

  // POK-206 — AC3: non-destructive preview. Resolve and build everything exactly
  // as a real record would, but do NOT write metrics.json. Used to prove a fix
  // works without consuming the start marker or clobbering an existing record.
  if (options.dryRun) {
    return {
      path: null,
      dryRun: true,
      metrics,
    };
  }

  const filePath = await writeIssueMetrics({
    root: options.root,
    date: options.date,
    issueId: options.issueId,
    metrics,
  });

  return {
    path: filePath,
    metrics,
  };
}

function orderedMetrics(metrics) {
  const result = {};
  for (const key of METRIC_KEYS) {
    result[key] = metrics[key];
  }
  return result;
}

// POK-203 — coerce a timestamp input to epoch ms at this chokepoint so all callers
// (CLI flags, start marker, programmatic) behave the same. Accepts: number (epoch ms),
// a bare all-digits string (epoch ms — the start marker / CLI format), or any other
// date-parseable string (ISO). null/undefined/unparseable → 0.
function toEpochMs(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return new Date(trimmed).getTime();
  }
  return 0;
}

// POK-206 — single resolution for the wall-clock endpoints used by the metrics
// record. Returns the persisted started_at / ended_at and the derived duration:
//   - no/invalid start            → { started: 0, ended: 0, duration: 0 } (측정 안 함)
//   - start known, no end given   → end = Date.now() (real wall-clock now — FALLBACK)
//   - start known, end given      → end = that value, used AS-IS (idempotent re-record /
//                                     freeze; also the AC4 path for excluding trailing wait)
//   - start known, end unparseable → { started, ended: 0, duration: 0 } (keep start for
//                                     later recovery, but stay honest about duration)
//
// POK-230 (AC4): `duration_ms` is ELAPSED wall-clock (see DURATION_MS_SEMANTICS).
// When an explicit `endedAt` is provided it is honored verbatim — callers (W3 /
// pokit-runner) SHOULD pass the last durable-change / verification timestamp so the
// trailing approval/idle wait is EXCLUDED from the elapsed window. The Date.now()
// fallback is used ONLY when no endedAt is supplied; that value DOES fold in any
// human wait between the last change and record time. POK-206 idempotent-freeze is
// preserved: a prior recorded ended_at is re-supplied here on re-run and wins.
function resolveTimes(startedAt, endedAt) {
  const startedRaw = toEpochMs(startedAt);
  const started = Number.isFinite(startedRaw) && startedRaw > 0 ? startedRaw : 0;
  if (started === 0) return { started: 0, ended: 0, duration: 0 };
  const endGiven = endedAt !== null && endedAt !== undefined && endedAt !== '';
  // Explicit endedAt is used as-is (AC4). Only fall back to Date.now() when none given.
  const endedRaw = endGiven ? toEpochMs(endedAt) : Date.now();
  const ended = Number.isFinite(endedRaw) && endedRaw > 0 ? endedRaw : 0;
  if (ended === 0) return { started, ended: 0, duration: 0 };
  return { started, ended, duration: Math.max(0, ended - started) };
}

function nonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

// POK-230 (AC5) — true only for a present, finite, non-negative numeric value.
// Used to decide whether an OPTIONAL additive subagent field (duration_ms /
// tool_uses) should be passed through (present + valid) or dropped (absent /
// malformed). null / undefined / NaN / negatives all drop.
function isOptionalNonNegative(value) {
  if (value === null || value === undefined) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

// POK-230 (AC3) — honest display of the main-session token field. Renders "미수집"
// (unmeasured) when main_tokens_collected is false (or the field is absent, e.g. a
// legacy 0.3.0 record), otherwise the integer value. Never surfaces a bare "0" that
// could be mistaken for a real measurement.
export function formatMainTokens(metrics = {}) {
  if (metrics.main_tokens_collected === true) {
    return String(nonNegativeInteger(metrics.main_total_tokens));
  }
  return '미수집';
}

function assertDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    throw new Error(`Invalid metrics date: ${date}`);
  }
}

function assertIssueId(issueId) {
  if (!/^POK-\d{3}$/.test(issueId ?? '')) {
    throw new Error(`Invalid POKit issue id: ${issueId}`);
  }
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}
