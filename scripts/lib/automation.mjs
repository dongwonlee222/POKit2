import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { appendEvent } from './event-log.mjs';

export const AUTOMATION_SCHEMA_VERSION = '0.1.0';
export const AUTOMATION_ROOT_REL = '.ai-os/automation';
export const AUTOMATION_FIRST_RUN_EVENT = 'automation_first_run';
export const AUTOMATION_RUN_EVENTS = Object.freeze({
  queued: 'automation_run_queued',
  retrying: 'automation_run_retrying',
  workerUnavailable: 'automation_worker_unavailable',
  lockBlocked: 'automation_lock_blocked',
  policyBlocked: 'automation_policy_blocked',
  stopped: 'automation_run_stopped',
  failed: 'automation_run_failed',
  completed: 'automation_run_completed',
});

const EVENT_BY_STATUS = Object.freeze({
  queued: AUTOMATION_RUN_EVENTS.queued,
  retryable: AUTOMATION_RUN_EVENTS.retrying,
  'worker-unavailable': AUTOMATION_RUN_EVENTS.workerUnavailable,
  'blocked-by-lock': AUTOMATION_RUN_EVENTS.lockBlocked,
  'blocked-by-policy': AUTOMATION_RUN_EVENTS.policyBlocked,
  'stopped-safe': AUTOMATION_RUN_EVENTS.stopped,
  'failed-final': AUTOMATION_RUN_EVENTS.failed,
  completed: AUTOMATION_RUN_EVENTS.completed,
});

const DEFAULT_NEXT_ACTION_BY_STATUS = Object.freeze({
  queued: '기다리거나 대기 항목을 취소합니다.',
  retryable: '한 번 재시도합니다. 다시 실패하면 사람 확인으로 전환합니다.',
  'worker-unavailable': '1회 재시도, queue, main fallback 중 증거 있는 경로를 고릅니다.',
  'blocked-by-lock': '잠금 보유자를 확인하고 재시도 또는 취소합니다.',
  'blocked-by-policy': '이슈나 정책을 수정하거나, 별도 승인 후 수동으로 진행합니다.',
  'stopped-safe': '설정을 확인한 뒤 필요하면 다시 켭니다.',
  'failed-final': '실패 원인을 수동 이슈로 승격하고 자동 재실행은 멈춥니다.',
  completed: '결과와 검증 receipt를 확인합니다.',
});

const PRESETS = Object.freeze({
  'state-doctor': Object.freeze({
    id: 'state-doctor',
    title: '상태 점검',
    purpose: 'current/status/handoff drift와 doctor 상태를 점검한다.',
    trigger: Object.freeze({
      kind: 'manual',
      label: '사람이 요청할 때',
    }),
    steps: Object.freeze([
      'current/status/handoff 상태 확인',
      'doctor 요약 실행',
      '드리프트 리포트 작성',
    ]),
  }),
  'release-gate-check': Object.freeze({
    id: 'release-gate-check',
    title: '릴리스 게이트 점검',
    purpose: '릴리스 전 sanitize, evidence, doctor, diff 상태를 확인한다.',
    trigger: Object.freeze({
      kind: 'manual',
      label: '릴리스 후보를 확인할 때',
    }),
    steps: Object.freeze([
      'release evidence 확인',
      'sanitize/evidence 체크',
      'doctor와 diff check 요약',
    ]),
  }),
});

export function buildAutomationDraft({
  input,
  preset,
  issueId,
  now = new Date(),
} = {}) {
  const base = preset ? PRESETS[preset] : null;
  if (preset && !base) {
    throw new Error(`unknown automation preset: ${preset}`);
  }

  const text = String(input ?? '').trim();
  const title = base?.title ?? inferTitle(text);
  const trigger = base?.trigger ?? inferTrigger(text);
  const id = base?.id ?? slugify(`${title}-${shortHash(text || title)}`);

  return {
    schema_version: AUTOMATION_SCHEMA_VERSION,
    id,
    title,
    user_facing_term: '자동화',
    purpose: base?.purpose ?? (text || `${title} 반복 작업을 안전하게 실행한다.`),
    trigger,
    steps: [...(base?.steps ?? inferSteps(text))],
    safety: {
      auto: [
        '정의 미리보기',
        '첫 실행 dry-run',
        '실행 receipt 기록',
      ],
      ask: [
        'push / release / 외부 쓰기',
        'gate_passed claim',
        '되돌리기 어려운 변경',
      ],
    },
    first_run: {
      mode: 'dry_run',
      mutating: false,
      requires_human_review_before_unattended: true,
    },
    tracking_issue: issueId ?? null,
    disabled: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function previewAutomation({
  root = process.cwd(),
  input,
  preset,
  issueId,
  now = new Date(),
} = {}) {
  const definition = buildAutomationDraft({ input, preset, issueId, now });
  return {
    definition,
    previewCard: buildPreviewCard(definition, { saved: false }),
    renderedPreviewCard: renderAutomationPreviewCard(definition, { saved: false }),
  };
}

export async function registerAutomation({
  root = process.cwd(),
  input,
  preset,
  issueId,
  now = new Date(),
} = {}) {
  const definition = buildAutomationDraft({ input, preset, issueId, now });
  const definitionPath = automationDefinitionPath(root, definition.id);
  await mkdir(path.dirname(definitionPath), { recursive: true });
  await writeJson(definitionPath, definition);

  return {
    definition,
    definitionPath,
    previewCard: buildPreviewCard(definition, { saved: true }),
    renderedPreviewCard: renderAutomationPreviewCard(definition, { saved: true }),
  };
}

export async function loadAutomation(root, id) {
  const safeId = normalizeAutomationId(id);
  const definitionPath = automationDefinitionPath(root, safeId);
  const definition = JSON.parse(await readFile(definitionPath, 'utf8'));
  return { definition, definitionPath };
}

export async function runAutomationFirstTrial({
  root = process.cwd(),
  id,
  now = new Date(),
  provider = 'unknown',
} = {}) {
  const { definition, definitionPath } = await loadAutomation(root, id);
  if (definition.disabled) {
    throw new Error(`automation ${definition.id} is disabled`);
  }

  const receipt = buildAutomationFirstRunReceipt({
    definition,
    provider,
    emittedAt: now.toISOString(),
  });
  const receiptPath = automationRunReceiptPath(root, definition.id, receipt.emitted_at);
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeJson(receiptPath, receipt);
  await appendEvent(root, receipt);

  return {
    definition,
    definitionPath,
    receipt,
    receiptPath,
    renderedRunCard: renderAutomationRunCard(receipt),
  };
}

export async function recordAutomationRunState({
  root = process.cwd(),
  id,
  status,
  eventName,
  runId,
  runKey,
  project = 'pokit',
  scope = 'default',
  mode = 'attended',
  mutating = false,
  policyTier,
  evidence,
  nextAction,
  provider = 'unknown',
  now = new Date(),
  details = {},
} = {}) {
  const { definition, definitionPath } = await loadAutomation(root, id);
  const receipt = buildAutomationRunStateReceipt({
    definition,
    status,
    eventName,
    runId,
    runKey,
    project,
    scope,
    mode,
    mutating,
    policyTier,
    evidence,
    nextAction,
    provider,
    emittedAt: now.toISOString(),
    details,
  });
  const receiptPath = await writeAutomationRunReceipt({ root, definition, receipt });

  return {
    definition,
    definitionPath,
    receipt,
    receiptPath,
    renderedRunCard: renderAutomationRunStateCard(receipt),
  };
}

export function buildAutomationRunStateReceipt({
  definition,
  status,
  eventName,
  runId,
  runKey,
  project = 'pokit',
  scope = 'default',
  mode = 'attended',
  mutating = false,
  policyTier,
  evidence,
  nextAction,
  provider = 'unknown',
  emittedAt,
  details = {},
} = {}) {
  const safeStatus = normalizeRunStatus(status);
  const event_name = eventName ?? EVENT_BY_STATUS[safeStatus];
  const emitted_at = emittedAt ?? new Date().toISOString();
  const safeRunId = runId ?? `${safeStatus}-${shortHash(`${definition.id}:${emitted_at}`)}`;
  const safeRunKey = runKey ?? buildAutomationRunKey({ automationId: definition.id, project, scope });
  const safePolicyTier = policyTier ?? inferPolicyTier({ status: safeStatus, mutating });
  const safeMutating = safePolicyTier === 'red' || safeStatus === 'blocked-by-policy'
    ? false
    : Boolean(mutating);
  const safeEvidence = normalizeEvidence(evidence, safeStatus);
  const safeNextAction = nextAction ?? DEFAULT_NEXT_ACTION_BY_STATUS[safeStatus];
  const normalizedDetails = normalizeRunDetails(safeStatus, details);

  return {
    schema_version: AUTOMATION_SCHEMA_VERSION,
    event_type: event_name,
    event_name,
    automation_id: definition.id,
    run_id: safeRunId,
    run_key: safeRunKey,
    issue_id: definition.tracking_issue,
    tracking_issue: definition.tracking_issue,
    mode,
    mutating: safeMutating,
    policy_tier: safePolicyTier,
    status: safeStatus,
    started_at: emitted_at,
    completed_at: safeStatus === 'completed' || safeStatus === 'failed-final' || safeStatus === 'stopped-safe'
      ? emitted_at
      : null,
    emitted_at,
    provider,
    evidence: safeEvidence,
    next_action: safeNextAction,
    ...normalizedDetails,
    payload: {
      schema_version: AUTOMATION_SCHEMA_VERSION,
      event_name,
      automation_id: definition.id,
      title: definition.title,
      run_id: safeRunId,
      run_key: safeRunKey,
      status: safeStatus,
      policy_tier: safePolicyTier,
      evidence: safeEvidence,
      next_action: safeNextAction,
      details: normalizedDetails,
    },
  };
}

export function buildAutomationRunKey({ automationId, project = 'pokit', scope = 'default' } = {}) {
  return `${normalizeAutomationId(automationId)}:${slugify(project) || 'project'}:${shortHash(scope)}`;
}

export async function disableAutomation({
  root = process.cwd(),
  id,
  reason = 'manual_stop',
  now = new Date(),
} = {}) {
  const { definition, definitionPath } = await loadAutomation(root, id);
  const next = {
    ...definition,
    disabled: true,
    disabled_reason: reason,
    updated_at: now.toISOString(),
  };
  await writeJson(definitionPath, next);
  return { definition: next, definitionPath };
}

export function buildAutomationFirstRunReceipt({
  definition,
  provider = 'unknown',
  emittedAt,
} = {}) {
  const emitted_at = emittedAt ?? new Date().toISOString();
  return {
    event_type: AUTOMATION_FIRST_RUN_EVENT,
    event_name: AUTOMATION_FIRST_RUN_EVENT,
    automation_id: definition.id,
    issue_id: definition.tracking_issue,
    tracking_issue: definition.tracking_issue,
    emitted_at,
    provider,
    mode: definition.first_run?.mode ?? 'dry_run',
    mutating: false,
    payload: {
      schema_version: AUTOMATION_SCHEMA_VERSION,
      event_name: AUTOMATION_FIRST_RUN_EVENT,
      automation_id: definition.id,
      title: definition.title,
      trigger: definition.trigger,
      steps: definition.steps,
      safety: definition.safety,
      tracking_issue: definition.tracking_issue,
    },
  };
}

export function buildPreviewCard(definition, { saved = false } = {}) {
  return {
    card_type: 'automation_preview',
    title: saved ? '자동화 미리보기 — 확인하고 저장됨' : '자동화 미리보기',
    fields: {
      id: definition.id,
      title: definition.title,
      purpose: definition.purpose,
      trigger: definition.trigger?.label,
      auto: definition.safety?.auto ?? [],
      ask: definition.safety?.ask ?? [],
      first_run: '첫 실행은 dry-run 시범운행으로 기록',
      tracking_issue: definition.tracking_issue,
      disabled: definition.disabled,
    },
  };
}

export function renderAutomationPreviewCard(definition, { saved = false } = {}) {
  return [
    `╭─ ${saved ? '✅ 자동화 미리보기 — 확인하고 저장됨' : '⚠️ 자동화 미리보기'}`,
    '│',
    `│ 이름      ${definition.title}`,
    `│ ID        ${definition.id}`,
    `│ 추적 이슈 ${definition.tracking_issue ?? '미지정'}`,
    '│',
    `│ 무엇을 함 ${definition.purpose}`,
    `│ 언제      ${definition.trigger?.label ?? '사람이 요청할 때'}`,
    '│',
    '│ 자동',
    ...definition.safety.auto.map((item) => `│   - ${item}`),
    '│',
    '│ 물어봄',
    ...definition.safety.ask.map((item) => `│   - ${item}`),
    '│',
    '├─ 첫 실행',
    '│   dry-run 시범운행으로 receipt를 남깁니다.',
    '╰─',
  ].join('\n');
}

export function renderAutomationRunCard(receipt) {
  return [
    '╭─ ✅ 자동화 첫 실행 시범운행',
    '│',
    `│ 자동화  ${receipt.automation_id}`,
    `│ 모드    ${receipt.mode}`,
    `│ 변경    ${receipt.mutating ? '있음' : '없음'}`,
    `│ 이슈    ${receipt.tracking_issue ?? '미지정'}`,
    `│ 기록    ${receipt.emitted_at}`,
    '╰─',
  ].join('\n');
}

export function renderAutomationRunStateCard(receipt) {
  const titleByStatus = {
    queued: '자동화 대기 중',
    retryable: '자동화 재시도',
    'worker-unavailable': '워커 사용 불가',
    'blocked-by-lock': '자동화 잠금 대기',
    'blocked-by-policy': '정책으로 차단',
    'stopped-safe': '자동화 안전 중단',
    'failed-final': '자동화 실패 확정',
    completed: '자동화 완료',
  };
  const title = titleByStatus[receipt.status] ?? '자동화 상태';
  const lines = [
    `╭─ ${receipt.status === 'completed' ? '✅' : '⚠️'} ${title}`,
    '│',
    `│ 자동화  ${receipt.automation_id}`,
    `│ 상태    ${receipt.status}`,
    `│ 실행키  ${receipt.run_key}`,
    `│ 변경    ${receipt.mutating ? '있음' : '없음'}`,
  ];

  if (receipt.status === 'worker-unavailable') {
    lines.push(
      `│ 워커    ${receipt.attempted_worker_type ?? 'unknown'}`,
      `│ 런타임  ${receipt.attempted_runtime ?? 'unknown'}`,
      `│ 이유    ${receipt.error ?? receipt.evidence?.fallback ?? 'unknown'}`,
      `│ 재시도  ${receipt.retry_count ?? 0}`,
      `│ 대체    ${receipt.replacement_path ?? '미지정'}`,
    );
  } else if (receipt.status === 'queued') {
    lines.push(
      `│ 이유    ${receipt.evidence?.fallback ?? 'same run_key already active'}`,
      `│ 대기    ${receipt.queue_mode ?? 'advisory'}`,
    );
  } else if (receipt.status === 'retryable') {
    lines.push(
      `│ 이유    ${receipt.reason ?? receipt.evidence?.fallback ?? 'retryable failure'}`,
      `│ 시도    ${receipt.attempt ?? 1} / ${receipt.max_attempts ?? 2}`,
    );
  } else if (receipt.status === 'blocked-by-policy') {
    lines.push(
      `│ 단계    ${receipt.blocked_step ?? 'red-tier step'}`,
      '│ 이유    red-tier 작업은 자동 진행할 수 없습니다.',
    );
  } else if (receipt.status === 'blocked-by-lock') {
    lines.push(
      `│ 잠금    ${receipt.lock_resource ?? receipt.run_key}`,
      `│ 보유자  ${receipt.lock_holder ?? 'unknown'}`,
    );
  }

  lines.push(
    '│',
    '├─ 다음',
    `│   ${receipt.next_action ?? '상태를 확인합니다.'}`,
    '╰─',
  );
  return lines.join('\n');
}

function automationDefinitionPath(root, id) {
  return path.join(root, AUTOMATION_ROOT_REL, 'definitions', `${normalizeAutomationId(id)}.json`);
}

function automationRunReceiptPath(root, id, emittedAt) {
  const stamp = String(emittedAt).replace(/[^0-9TZ]/g, '');
  return path.join(root, AUTOMATION_ROOT_REL, 'runs', normalizeAutomationId(id), `${stamp}.json`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeAutomationRunReceipt({ root, definition, receipt }) {
  const receiptPath = automationRunReceiptPath(root, definition.id, receipt.emitted_at);
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeJson(receiptPath, receipt);
  await appendEvent(root, receipt);
  return receiptPath;
}

function normalizeRunStatus(status) {
  const safeStatus = String(status ?? '').trim();
  if (!EVENT_BY_STATUS[safeStatus]) {
    throw new Error(`unknown automation run status: ${status}`);
  }
  return safeStatus;
}

function normalizeEvidence(evidence, status) {
  return {
    preview: null,
    verification: null,
    diff: null,
    fallback: status === 'worker-unavailable' ? 'worker-unavailable' : null,
    ...(evidence ?? {}),
  };
}

function inferPolicyTier({ status, mutating }) {
  if (status === 'blocked-by-policy') return 'red';
  if (mutating) return 'yellow';
  return 'green';
}

function normalizeRunDetails(status, details) {
  if (status === 'queued') {
    return {
      queue_mode: details.queueMode ?? details.queue_mode ?? 'advisory',
      replaced_run_id: details.replacedRunId ?? details.replaced_run_id ?? null,
    };
  }
  if (status === 'retryable') {
    return {
      attempt: numberOrDefault(details.attempt, 1),
      max_attempts: numberOrDefault(details.maxAttempts ?? details.max_attempts, 2),
      wait_ms: numberOrDefault(details.waitMs ?? details.wait_ms, 60000),
      reason: details.reason ?? 'retryable failure',
      previous_run_id: details.previousRunId ?? details.previous_run_id ?? null,
    };
  }
  if (status === 'worker-unavailable') {
    return {
      attempted_runtime: details.attemptedRuntime ?? details.attempted_runtime ?? 'unknown',
      attempted_worker_type: details.attemptedWorkerType ?? details.attempted_worker_type ?? 'unknown',
      error: details.error ?? 'worker unavailable',
      retry_count: numberOrDefault(details.retryCount ?? details.retry_count, 0),
      replacement_path: details.replacementPath ?? details.replacement_path ?? 'main-session fallback',
      residual_risk: details.residualRisk ?? details.residual_risk ?? 'No independent worker review was executed.',
    };
  }
  if (status === 'blocked-by-policy') {
    return {
      blocked_step: details.blockedStep ?? details.blocked_step ?? 'red-tier step',
      approval_required: true,
    };
  }
  if (status === 'blocked-by-lock') {
    return {
      lock_resource: details.lockResource ?? details.lock_resource ?? null,
      lock_holder: details.lockHolder ?? details.lock_holder ?? 'unknown',
    };
  }
  return {};
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeAutomationId(id) {
  const safe = slugify(id);
  if (!safe) throw new Error('automation id is required');
  return safe;
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function shortHash(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 8);
}

function inferTitle(text) {
  if (/release|릴리스|게이트/i.test(text)) return '릴리스 게이트 점검';
  if (/doctor|상태|드리프트/i.test(text)) return '상태 점검';
  if (/의존성|dependency|deps/i.test(text)) return '의존성 점검';
  return '사용자 자동화';
}

function inferTrigger(text) {
  if (/매주|weekly|월요일|화요일|수요일|목요일|금요일|토요일|일요일/i.test(text)) {
    return { kind: 'weekly', label: '매주 지정한 때' };
  }
  if (/매일|daily|아침|저녁/i.test(text)) {
    return { kind: 'daily', label: '매일 지정한 때' };
  }
  return { kind: 'manual', label: '사람이 요청할 때' };
}

function inferSteps(text) {
  if (/release|릴리스|게이트/i.test(text)) {
    return [
      '릴리스 후보 확인',
      '게이트 증거 점검',
      '결과 receipt 기록',
    ];
  }
  if (/doctor|상태|드리프트/i.test(text)) {
    return [
      '상태 파일 확인',
      'doctor 요약 실행',
      '결과 receipt 기록',
    ];
  }
  return [
    text || '반복 작업 정의 확인',
    '안전 미리보기',
    '첫 실행 receipt 기록',
  ];
}
