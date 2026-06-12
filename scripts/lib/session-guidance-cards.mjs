// Session guidance cards (POK-246).
//
// The runner (runner_contract_calculator, POK-235 role model) COMPUTES and
// PUBLISHES these card contracts; the skill / main session only DISPLAYS the card
// and ACTS on it. The runner is NOT the executor. These functions are pure: they
// take session metadata / proposed-update arrays and return a card contract.
//
// AC4 — multi-session internal tokens (session_id, the worktree branch that carries
// it, worktree/shared-state paths, lock holder/lease) must never reach a user
// surface. Enforcement is two-layer: (a) the builders below structurally exclude
// internal tokens from every user-facing field; (b) renderSessionGuidanceCard
// routes each line through the plain-language chokepoint (plainifyUserText) and then
// asserts the whole rendered string is free of internal tokens. The display alias
// (display_id, e.g. S001) and issue ids (POK-XXX) are PO-readable and allowed.

import { plainifyUserText } from './user-text.mjs';

export const SESSION_GUIDANCE_SCHEMA_VERSION = '0.1.0';

// Internal session tokens that must not appear on a user surface. Self-contained
// (does not depend on user-text's forbidden list) so the guard holds even if a
// caller forgets to route text through the chokepoint.
const INTERNAL_SESSION_TOKEN_PATTERNS = [
  { name: 'session_id', pattern: /\bses_\w{6,}\b/i },
  { name: 'session_branch', pattern: /\bpokit\/[^\s/]+\/[A-Za-z]+-\d{3}\/ses_/i },
  { name: 'worktree_path', pattern: /(?:\S*-worktrees\/|\.pokit\/sessions\/|\.git\/pokit\/)/i },
  { name: 'lock_internals', pattern: /\b(?:lease_expiry|acquired_at|lock_id|holder)\s*[:=]/i },
];

/**
 * Return the names of internal session tokens found in text. Empty array = clean.
 */
export function findInternalSessionTokens(text) {
  const value = String(text ?? '');
  return INTERNAL_SESSION_TOKEN_PATTERNS
    .filter(({ pattern }) => pattern.test(value))
    .map(({ name }) => name);
}

/**
 * Throw if text contains an internal session token (AC4 guard).
 */
export function assertNoInternalSessionTokens(text) {
  const leaked = findInternalSessionTokens(text);
  if (leaked.length > 0) {
    throw new Error(`internal session token leaked: ${leaked.join(', ')}`);
  }
}

const TASK_SESSION_CAN_DO = Object.freeze([
  '이 작업공간 안에서만 파일을 고친다',
  '집중 테스트·검증을 돌린다',
  '제안(proposed_update) 한 건을 남긴다',
  '새로 발견한 일은 백로그 제안으로 적는다',
]);

const TASK_SESSION_CANNOT_DO = Object.freeze([
  '완료(게이트 통과)를 선언하지 않는다',
  '공유 상태(current/handoff/issue-index/release-scope)를 고치지 않는다',
  'push·main 병합·최종 통합 커밋을 하지 않는다',
  '새 이슈를 만들거나 활성화하지 않는다',
]);

const CARD_APPROVAL_BOUNDARIES = Object.freeze({
  display_only: true,
  approval_required: true,
  approves_status_transition: false,
  approves_durable_work: false,
  approves_gate_pass: false,
  approves_external_write: false,
});

/**
 * AC1 — task-session startup guidance card, built from session metadata.
 * Never places session_id / branch / worktree_path / holder into any field.
 */
export function buildTaskSessionGuidanceCard(session = {}) {
  const issue = session.issue_id ?? null;
  return {
    card_type: 'session_guidance',
    role: 'task_session',
    variant: 'startup',
    ...CARD_APPROVAL_BOUNDARIES,
    fields: {
      title: '🧭 작업 세션 안내',
      role_line: `이 채팅은 ${issue ?? '이 이슈'} 작업 세션입니다.`,
      issue,
      project: session.project ?? null,
      alias: session.display_id ?? null,
      can_do: [...TASK_SESSION_CAN_DO],
      cannot_do: [...TASK_SESSION_CANNOT_DO],
      next_action: '검증 결과와 변경 요약을 main/integration 세션에 넘깁니다',
    },
  };
}

function toProposalRows(proposedUpdates = []) {
  return proposedUpdates.map((update, index) => ({
    index: index + 1,
    summary: update.diff_summary ?? '(요약 없음)',
    decision_needed: update.main_decision_needed ?? 'accept',
    risk: (Array.isArray(update.risks) && update.risks[0]) || '없음',
  }));
}

/**
 * AC2 — integration/main-session startup guidance card, built from proposed updates.
 * Lists each proposal's summary / decision / risk but never the session_id.
 */
export function buildIntegrationGuidanceCard({ issueId = null, proposedUpdates = [] } = {}) {
  const proposals = toProposalRows(proposedUpdates);
  return {
    card_type: 'session_guidance',
    role: 'integration_session',
    variant: 'startup',
    ...CARD_APPROVAL_BOUNDARIES,
    fields: {
      title: '🧭 통합 세션 안내',
      issue: issueId,
      role_line: `이 채팅은 ${issueId ?? '이 이슈'} 통합 세션입니다.`,
      proposals,
      proposal_count: proposals.length,
      next_action: proposals.length > 0
        ? '1번 통합'
        : '받은 제안 없음 — 작업 세션의 제안을 기다립니다',
    },
  };
}

/**
 * AC3 — "지금 뭐 하면 돼?" status card. Role is detected from the session
 * (task_session) vs the integration/main context (no task session).
 */
export function buildSessionStatusCard({ session = null, proposedUpdates = [] } = {}) {
  const isTask = session?.role === 'task_session';
  if (isTask) {
    const issue = session.issue_id ?? null;
    return {
      card_type: 'session_guidance',
      role: 'task_session',
      variant: 'status',
      ...CARD_APPROVAL_BOUNDARIES,
      fields: {
        title: '🧭 지금 할 일',
        role_line: `이 채팅은 ${issue ?? '이 이슈'} 작업 세션입니다.`,
        current_state: '작업 중 — 아직 제안 전',
        options: [
          '작업공간에서 변경 마무리',
          '집중 테스트 돌리기',
          '제안 올려줘',
        ],
      },
    };
  }
  const count = proposedUpdates.length;
  return {
    card_type: 'session_guidance',
    role: 'integration_session',
    variant: 'status',
    ...CARD_APPROVAL_BOUNDARIES,
    fields: {
      title: '🧭 지금 할 일',
      role_line: '이 채팅은 통합 세션입니다.',
      current_state: count > 0 ? `받은 제안 ${count}건` : '받은 제안 없음',
      options: count > 0
        ? ['받은 제안 검토', '1번 통합']
        : ['작업 세션의 제안 기다리기'],
    },
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────
// Open-right ASCII, matching the repo's other lifecycle cards. Every text line is
// routed through plainifyUserText (the chokepoint) and the whole result is asserted
// internal-token-free before return.

function plainLine(text) {
  return `│ ${plainifyUserText(text)}`.replace(/\s+$/, '');
}

function plainKeyValue(key, value) {
  return plainifyUserText(`│   ${key}  ${value}`).replace(/\s+$/, '');
}

function plainBullet(text) {
  return plainifyUserText(`│   - ${text}`).replace(/\s+$/, '');
}

function renderTaskSessionCard(fields) {
  const lines = [`╭─ ${plainifyUserText(fields.title)}`, '│'];
  lines.push(plainLine('역할'));
  lines.push(plainifyUserText(`│   ${fields.role_line}`).replace(/\s+$/, ''));
  if (fields.issue) lines.push(plainKeyValue('이슈    ', fields.issue));
  if (fields.project) lines.push(plainKeyValue('프로젝트', fields.project));
  if (fields.alias) lines.push(plainKeyValue('별칭    ', fields.alias));
  lines.push('│');
  lines.push(plainLine('할 수 있는 것'));
  for (const item of fields.can_do) lines.push(plainBullet(item));
  lines.push(plainLine('할 수 없는 것'));
  for (const item of fields.cannot_do) lines.push(plainBullet(item));
  lines.push(`├─ ${plainifyUserText('다음 한 행동')}`);
  lines.push(plainifyUserText(`│   ${fields.next_action}`).replace(/\s+$/, ''));
  lines.push('╰─');
  return lines.join('\n');
}

function renderIntegrationCard(fields) {
  const lines = [`╭─ ${plainifyUserText(fields.title)}`, '│'];
  lines.push(plainLine('역할'));
  lines.push(plainifyUserText(`│   ${fields.role_line}`).replace(/\s+$/, ''));
  if (fields.issue) lines.push(plainKeyValue('이슈', fields.issue));
  lines.push('│');
  lines.push(plainLine(`받은 제안 (${fields.proposal_count}건)`));
  if (fields.proposals.length === 0) {
    lines.push(plainifyUserText('│   없음').replace(/\s+$/, ''));
  } else {
    for (const p of fields.proposals) {
      lines.push(plainifyUserText(`│   ${p.index}. ${p.summary}  · 결정: ${p.decision_needed}  · 위험: ${p.risk}`).replace(/\s+$/, ''));
    }
  }
  lines.push(`├─ ${plainifyUserText('다음 한 행동')}`);
  lines.push(plainifyUserText(`│   ${fields.next_action}`).replace(/\s+$/, ''));
  lines.push('╰─');
  return lines.join('\n');
}

function renderStatusCard(fields) {
  const lines = [`╭─ ${plainifyUserText(fields.title)}`, '│'];
  lines.push(plainLine('역할'));
  lines.push(plainifyUserText(`│   ${fields.role_line}`).replace(/\s+$/, ''));
  lines.push(plainKeyValue('현재', fields.current_state));
  lines.push(`├─ ${plainifyUserText('할 수 있는 선택')}`);
  for (const item of fields.options) lines.push(plainBullet(item));
  lines.push('╰─');
  return lines.join('\n');
}

/**
 * Render any session_guidance card to open-right ASCII. Throws if the rendered
 * output would leak an internal session token (AC4).
 */
export function renderSessionGuidanceCard(card) {
  if (!card || card.card_type !== 'session_guidance') {
    throw new Error('renderSessionGuidanceCard requires a session_guidance card');
  }
  const { fields, variant, role } = card;
  let rendered;
  if (variant === 'status') {
    rendered = renderStatusCard(fields);
  } else if (role === 'integration_session') {
    rendered = renderIntegrationCard(fields);
  } else {
    rendered = renderTaskSessionCard(fields);
  }
  assertNoInternalSessionTokens(rendered);
  return rendered;
}
