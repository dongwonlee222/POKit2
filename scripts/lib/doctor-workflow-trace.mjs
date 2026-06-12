// POK-310 — extracted from scripts/pokit-doctor.mjs
// Stateless workflow-trace evidence check functions and shared constants.
// No IO, no async. Caller injects { pass, fail } from doctor module scope.

export const VALID_FALLBACK_REASON_ENUM = [
  'worker-unavailable',
  'global-state-only',
  'cross-file-invariant',
  'trivial-scope',
];

// ── Private helpers (local copies; doctor originals retained) ─────────────────

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionText(text, section) {
  const heading = text.match(new RegExp(`^## ${escapeRegex(section)}\\s*$`, 'm'));
  if (!heading) return '';
  const bodyStart = heading.index + heading[0].length;
  const rest = text.slice(bodyStart);
  const nextHeading = rest.match(/\n##\s+/);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

function isSprintAtLeast(sprint, minimumMinor) {
  const match = String(sprint ?? '').match(/^v0\.(\d+)\.0$/);
  return match ? Number(match[1]) >= minimumMinor : false;
}

function requiresPostChangeReviewEvidence(filePath, frontmatter) {
  const id = frontmatter.id ?? filePath.match(/POK-\d{3}/)?.[0] ?? null;
  const issueNumber = id?.match(/POK-(\d{3})/) ? Number(id.match(/POK-(\d{3})/)[1]) : 0;
  if (frontmatter.sprint === 'v0.11.0' && id === 'POK-180') return true;
  return isSprintAtLeast(frontmatter.sprint, 12) || (frontmatter.sprint === 'v0.11.0' && issueNumber >= 184);
}

// ── Exported checks ───────────────────────────────────────────────────────────

export function checkWorkflowTraceWorkerEvidence(text, filePath, items, { pass, fail }) {
  const trace = sectionText(text, 'Workflow Trace');
  const workersMatch = trace.match(/Workers:\s*([^\n]+)/i);
  if (!workersMatch) {
    fail(items, 'workflow_trace_worker_evidence', filePath,
      'Workflow Trace is missing `Workers:` evidence.',
      'Add `Workers: <worker list>` or `Workers: none (narrow fallback)` with fallback evidence.'
    );
    return;
  }

  const workersValue = workersMatch[1].trim();
  if (!/^none\b/i.test(workersValue)) {
    pass(items, 'workflow_trace_worker_evidence', filePath, `Workflow Trace records Workers: ${workersValue}.`);
    return;
  }

  const reasonMatch = trace.match(/Fallback reason:\s*([^\n]+)/i);
  if (!reasonMatch) {
    fail(items, 'workflow_trace_worker_evidence', filePath,
      'Workflow Trace uses `Workers: none` but is missing `Fallback reason:`.',
      `Add one of: ${VALID_FALLBACK_REASON_ENUM.join(' | ')}.`
    );
    return;
  }

  const reason = reasonMatch[1].trim();
  if (!VALID_FALLBACK_REASON_ENUM.includes(reason)) {
    fail(items, 'workflow_trace_worker_evidence', filePath,
      `Fallback reason "${reason}" is not one of: ${VALID_FALLBACK_REASON_ENUM.join(' | ')}.`,
      '`needs_subagent_authorization` is an authorization stop state, not a worker-unavailable fallback.'
    );
    return;
  }

  if (reason === 'cross-file-invariant') {
    const invariantMatch = trace.match(/Invariant:\s*([^\n]+)/i);
    if (!invariantMatch || invariantMatch[1].trim().length === 0) {
      fail(items, 'workflow_trace_worker_evidence', filePath,
        'Fallback reason cross-file-invariant requires `Invariant:` evidence.',
        'Add `Invariant: <one-line invariant>` to explain why fan-out was unsafe.'
      );
      return;
    }
  }

  pass(items, 'workflow_trace_worker_evidence', filePath, `Fallback reason "${reason}" is valid.`);
}

export function checkWorkflowTracePostChangeReviewEvidence(text, filePath, frontmatter, items, { pass, fail }) {
  if (!requiresPostChangeReviewEvidence(filePath, frontmatter)) return;

  const trace = sectionText(text, 'Workflow Trace');
  const reviewMatch = trace.match(/^Post-change review:\s*([^\n]+)/im);
  if (!reviewMatch) {
    fail(items, 'workflow_trace_post_change_review', filePath,
      'Workflow Trace is missing `Post-change review:` evidence.',
      'Add `Post-change review: review_worker` or a narrow skip with `Post-change review reason:` before gate-pass evidence.'
    );
    return;
  }

  const review = reviewMatch[1].trim();
  if (!['review_worker', 'skipped'].includes(review)) {
    fail(items, 'workflow_trace_post_change_review', filePath,
      `Post-change review "${review}" is not valid.`,
      'Use `review_worker` or `skipped` only.'
    );
    return;
  }

  if (review === 'skipped') {
    const reasonMatch = trace.match(/^Post-change review reason:\s*([^\n]+)/im);
    const reason = reasonMatch?.[1]?.trim();
    if (!['global-state-only', 'trivial-scope', 'worker-unavailable'].includes(reason)) {
      fail(items, 'workflow_trace_post_change_review', filePath,
        'Skipped Post-change review requires a narrow reason.',
        'Add `Post-change review reason: global-state-only`, `Post-change review reason: trivial-scope`, or `Post-change review reason: worker-unavailable`.'
      );
      return;
    }
  }

  const findingsMatch = trace.match(/^Review findings:\s*([^\n]+)/im);
  if (!findingsMatch) {
    fail(items, 'workflow_trace_post_change_review', filePath,
      'Workflow Trace is missing `Review findings:` evidence.',
      'Add `Review findings: none`, `fixed`, or `deferred-with-reason`.'
    );
    return;
  }

  const findings = findingsMatch[1].trim();
  if (!['none', 'fixed', 'deferred-with-reason'].includes(findings)) {
    fail(items, 'workflow_trace_post_change_review', filePath,
      `Review findings "${findings}" is not resolved evidence.`,
      'Use `none`, `fixed`, or `deferred-with-reason`; do not gate-pass with TODO or unresolved findings.'
    );
    return;
  }

  if (findings === 'deferred-with-reason' && !/^Review findings reason:\s*(?!\s*$).+/im.test(trace)) {
    fail(items, 'workflow_trace_post_change_review', filePath,
      '`Review findings: deferred-with-reason` requires `Review findings reason:` evidence.',
      'Explain the explicit deferral reason in Workflow Trace.'
    );
    return;
  }

  pass(items, 'workflow_trace_post_change_review', filePath, `Workflow Trace records Post-change review: ${review}, Review findings: ${findings}.`);
}
