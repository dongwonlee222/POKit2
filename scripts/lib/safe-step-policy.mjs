// POK-247 — safe-step autopilot policy (the runner_contract_calculator's 🟢/🔴 layer).
//
// The runner COMPUTES which upcoming steps are safe to auto-progress (🟢) vs which
// must stop for a human (🔴); the skill/main ACTS on the classification. This module
// is the single source of that classification plus the FRG-001 gate guard.
//
// SSoT boundary: push-policy.mjs answers "is the actor ALLOWED to act without approval"
// (an actor-capability question). This module answers "should the autopilot STOP for a
// human" (an autopilot-flow question) — a superset concern. For `push` it delegates to
// push-policy.mjs so the push approval gate stays a single source of truth. gate_pass is
// allowed for the main session by push-policy, but POK-247 + Human Judgment Points keep
// gate_passed a human-declared step, so it is always 🔴 here regardless of actor permission.

import { decidePolicyAction } from './push-policy.mjs';

export const STEP_SIGNAL = Object.freeze({ AUTO: 'auto', CONFIRM: 'confirm' });

// 🟢 auto-progress: reversible, evidence-backed steps that should not stop for a human.
export const AUTO_STEP_ACTIONS = Object.freeze(
  new Set(['code_change', 'verify', 'commit', 'proposal'])
);

// 🔴 human-confirm: outward / irreversible / completion-declaring steps that must stop.
export const CONFIRM_STEP_ACTIONS = Object.freeze(
  new Set(['push', 'gate_pass', 'release', 'external_send', 'scope_change'])
);

const STEP_LABELS = Object.freeze({
  code_change: '코드 변경',
  verify: '검증 실행',
  commit: '커밋',
  proposal: '제안 생성',
  push: '푸시',
  gate_pass: '게이트 통과(완료)',
  release: '릴리즈',
  external_send: '외부 발송',
  scope_change: '범위 변경',
});

// The representative execution chain surfaced on the execution-reasoning card so the PO
// sees where the run auto-flows (🟢) and where it stops (🔴).
export const DEFAULT_EXECUTION_STEPS = Object.freeze([
  'code_change',
  'verify',
  'commit',
  'push',
  'gate_pass',
]);

function normalizeStep(step) {
  return String(step ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function buildSignal(signal, step, label, reason) {
  const auto = signal === STEP_SIGNAL.AUTO;
  return {
    step,
    label,
    signal,
    emoji: auto ? '🟢' : '🔴',
    requires_human: !auto,
    reason,
  };
}

/**
 * Classify a single execution step as 🟢 auto-progress or 🔴 human-confirm.
 * Unknown steps fail-closed to 🔴 (never silently auto).
 */
export function classifyStepSignal(step, { actor = 'project_main_session', pushPolicy = 'po-confirm' } = {}) {
  const normalized = normalizeStep(step);
  const label = STEP_LABELS[normalized] ?? (normalized || 'unknown');

  // push is always 🔴 (Human Judgment Point: external write) and is also listed in
  // CONFIRM_STEP_ACTIONS as the canonical classification. This branch consults
  // push-policy.mjs — the SSoT for the push APPROVAL requirement — only to surface WHY
  // (push requires PO approval). The 🔴 signal is fixed by POK-247 and never flips to 🟢,
  // even when push is pre-approved, so we do not derive the signal from the policy flag.
  if (normalized === 'push') {
    const decision = decidePolicyAction({ actor, action: 'push', pushPolicy });
    const why = decision.requires_approval ? 'push-policy: push는 PO 승인 필요' : 'push는 항상 사람 확인(외부 쓰기)';
    return buildSignal(STEP_SIGNAL.CONFIRM, normalized, label, why);
  }

  if (CONFIRM_STEP_ACTIONS.has(normalized)) {
    return buildSignal(STEP_SIGNAL.CONFIRM, normalized, label, '되돌리기 어렵거나 외부/완료 단계 → 사람 확인');
  }
  if (AUTO_STEP_ACTIONS.has(normalized)) {
    return buildSignal(STEP_SIGNAL.AUTO, normalized, label, '되돌릴 수 있고 증거가 남는 단계 → 자동 진행');
  }
  // Fail-closed: an unknown step defaults to human confirm, never to silent auto.
  return buildSignal(STEP_SIGNAL.CONFIRM, normalized, label, '미분류 단계 → fail-closed(사람 확인)');
}

/** Build the 🟢/🔴 plan for a list of steps (defaults to the standard execution chain). */
export function buildSafeStepPlan(steps = DEFAULT_EXECUTION_STEPS, opts = {}) {
  return steps.map((step) => classifyStepSignal(step, opts));
}

// ── FRG-001 gate guard (POK-247 AC7) ────────────────────────────────────────────
// gate_passed must NOT be auto-produced without independent, FRESH verification
// evidence. A verification_ready checkpoint is emitted by the REAL verification path
// (pokit-issue Step 5 / skill-checkpoint CLI) BEFORE gate-pass. gate-pass must not
// self-emit it — that was the POK-228 self-certification hole this issue closes.
//
// Freshness (closes the stale-evidence gap): when the issue has a prior after_gate_pass
// event (i.e. it was already gated once and is being re-gated after rework/reopen), the
// verification_ready must be emitted strictly AFTER that latest gate-pass — an old
// verification_ready from a previous cycle does not count. On a first gate (no prior
// after_gate_pass) any verification_ready is fresh.

export function hasIndependentVerificationReady(receipts = []) {
  return Array.isArray(receipts) && receipts.some((receipt) => receipt?.step === 'verification_ready');
}

function emittedMs(record) {
  const ms = Date.parse(record?.emitted_at ?? '');
  return Number.isNaN(ms) ? null : ms;
}

function latestEmittedMs(events = []) {
  let latest = null;
  for (const event of events ?? []) {
    const ms = emittedMs(event);
    if (ms !== null && (latest === null || ms > latest)) latest = ms;
  }
  return latest;
}

export function assertFreshVerificationBeforeGate({ receipts = [], afterGatePassEvents = [] } = {}) {
  const verificationReady = (receipts ?? []).filter((receipt) => receipt?.step === 'verification_ready');
  if (verificationReady.length === 0) {
    return { ok: false, reason: 'verification_evidence_missing' };
  }

  const latestGateMs = latestEmittedMs(afterGatePassEvents);
  if (latestGateMs === null) {
    // First gate (no prior after_gate_pass anchor) — any verification_ready is fresh.
    return { ok: true, reason: 'verification_ready_present' };
  }

  const hasFresh = verificationReady.some((receipt) => {
    const ms = emittedMs(receipt);
    return ms !== null && ms > latestGateMs;
  });
  return hasFresh
    ? { ok: true, reason: 'verification_ready_after_last_gate' }
    : { ok: false, reason: 'verification_evidence_stale' };
}
