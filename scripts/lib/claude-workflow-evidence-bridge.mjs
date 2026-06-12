// Pure evidence-conversion helpers — no file I/O, no gate claim, no real API calls.

export const EVIDENCE_SCHEMA_VERSION = '0.1.0';

// Unmeasurable values default to 0/false, never null (POKit metrics rule).
export function buildMetricsFromWorkflowResult(workflowResult, opts = {}) {
  const {
    acTotal = 0,
    acPassed = 0,
    changedFiles = 0,
    changedLines = 0,
    reworkCount = 0,
    testFailBeforeCommit = false,
    afrTriggered = false,
    gateReopenCount = 0,
    sessionCount = 1,
  } = opts;

  const agents = Array.isArray(workflowResult?.agents) ? workflowResult.agents : [];

  const inputTokens = agents.reduce((sum, a) => sum + (a.input_tokens ?? 0), 0);
  const outputTokens = agents.reduce((sum, a) => sum + (a.output_tokens ?? 0), 0);

  // POK-199 (AC1/AC5): Build per-agent attribution array from the agents list.
  // Each entry records the per-agent total_tokens (the only value the platform
  // exposes per-agent); per-agent input/output are NOT stored — their absence is
  // the honest "미수집" signal (D2).
  //
  // NOTE: when the real Workflow result exposes only an aggregate (no per-agent
  // split), per-agent total_tokens may be 0 (미수집) and the aggregate lives in
  // the top-level total_tokens field. The orchestrator is responsible for
  // assembling the agents array from (script return + task-usage notification).
  const subagents = agents.map((a) => ({
    model: String(a.model ?? a.worker_kind ?? 'unknown'),
    worker_type: String(a.worker_kind ?? a.worker_type ?? 'unknown'),
    // POK-199 review: clamp to non-negative integer so no fake value (NaN→null,
    // negative, or float) ever leaks into a written metrics.json from this path.
    total_tokens: toNonNegativeInteger(
      (a.total_tokens != null)
        ? a.total_tokens
        : ((a.input_tokens ?? 0) + (a.output_tokens ?? 0))
    ),
  }));

  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    duration_ms: workflowResult?.duration_ms ?? 0,
    // POK-206 — keep the 0-convention explicit (측정 안 함) so the written JSON has
    // started_at/ended_at present as 0, never absent. A Workflow result has no
    // wall-clock endpoints; a later gate-pass that reads this record must see an
    // honest 0 (incomplete → not used for idempotent freeze), not a dropped key.
    started_at: 0,
    ended_at: 0,
    session_count: sessionCount,
    changed_files: changedFiles,
    changed_lines: changedLines,
    subagent_count: workflowResult?.subagent_count ?? agents.length,
    ac_total: acTotal,
    ac_passed: acPassed,
    rework_count: reworkCount,
    test_fail_before_commit: testFailBeforeCommit,
    afr_triggered: afrTriggered,
    gate_reopen_count: gateReopenCount,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    subagents,
  };
}

// Builds the `## Workflow Trace` section (POK-165); optional lines omitted when null/empty.
export function buildWorkflowTraceSection({
  executionApproval,
  mode = 'automatic',
  workerAuthorization = 'authorized',
  workers = [],
  metricsPath,
  fallbackReason = null,
  invariant = null,
  cannotFanOutReason = null,
} = {}) {
  // When no workers ran but a fallback reason explains it, use the sentinel label.
  const workersLine =
    workers.length === 0 && fallbackReason
      ? 'none (narrow fallback)'
      : workers.join(', ') || 'none';

  const lines = [
    '## Workflow Trace',
    '',
    'Skill invocation: pokit-issue',
    `Execution approval: ${executionApproval}`,
    `Mode: ${mode}`,
    `Worker authorization: ${workerAuthorization}`,
    `Workers: ${workersLine}`,
  ];

  if (fallbackReason) lines.push(`Fallback reason: ${fallbackReason}`);
  if (invariant) lines.push(`Invariant: ${invariant}`);
  if (cannotFanOutReason) lines.push(`Cannot fan-out reason: ${cannotFanOutReason}`);

  lines.push(`Metrics: ${metricsPath}`);

  return lines.join('\n');
}

// Convenience wrapper -> { metrics, traceSection }; derives worker kinds from agents.
export function convertWorkflowResult(workflowResult, { trace = {}, metrics = {} } = {}) {
  const agents = Array.isArray(workflowResult?.agents) ? workflowResult.agents : [];

  // Derive distinct worker kinds from agents unless caller overrides.
  const derivedWorkers =
    trace.workers !== undefined
      ? trace.workers
      : [...new Set(agents.map((a) => a.worker_kind).filter(Boolean))];

  const builtMetrics = buildMetricsFromWorkflowResult(workflowResult, metrics);

  // Subagent count consistency: positive workers list ↔ subagent_count > 0.
  // If caller passed subagent_count=0 but workers ran, honour the agent list count instead.
  if (derivedWorkers.length > 0 && builtMetrics.subagent_count === 0) {
    builtMetrics.subagent_count = agents.length || derivedWorkers.length;
  }

  const traceSection = buildWorkflowTraceSection({
    ...trace,
    workers: derivedWorkers,
  });

  return { metrics: builtMetrics, traceSection };
}

// POK-230 (AC1) — extract JUST the subagents[] array + aggregate from a workflow
// result, in the shape the runner's --subagents / recordIssueCompletionMetrics
// consumes. Reuses buildMetricsFromWorkflowResult so the per-agent normalization
// (model/worker_type defaults, non-negative integer clamp) stays single-sourced.
// Returns { subagents: [{ model, worker_type, total_tokens }], total_tokens }.
// total_tokens here is the sum of per-agent totals (미수집 entries contribute 0),
// which is the value metrics recording should attribute to subagents.
export function extractSubagentsForMetrics(workflowResult) {
  const { subagents } = buildMetricsFromWorkflowResult(workflowResult);
  const total_tokens = subagents.reduce((sum, a) => sum + a.total_tokens, 0);
  return { subagents, total_tokens };
}

// POK-199 review — local non-negative integer coercion (mirrors issue-metrics
// nonNegativeInteger, which is not exported). Keeps per-agent total_tokens honest:
// NaN/negative/float never reach a written metrics.json from the bridge path.
function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}
