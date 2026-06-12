const RIGHT_SIDE_BORDERS = /[┐┤┘]/g;

export function renderStartupLifecycleCard({ lifecycleCard = {}, now = new Date() } = {}) {
  const current = lifecycleCard.fields?.current ?? {};
  const context = lifecycleCard.fields?.context ?? {};
  const inputWaiting = lifecycleCard.fields?.input_waiting ?? {};
  const source = lifecycleCard.source ?? lifecycleCard.fields?.source;
  const route = inputWaiting.route ?? deriveStartupRoute(current.state);

  const lines = [
    '╭─ 🚀 POKit2 세션 시작',
    '│',
    '│ 접속',
    `│   일시    ${formatKst(now)}`,
    `│   모드    ${valueOrFallback(lifecycleCard.mode, '상태 확인')}`,
    '│',
    '│ 현재 진행',
    `│   프로젝트  ${valueOrFallback(current.project)}`,
    `│   스프린트  ${valueOrFallback(current.sprint)}`,
    `│   이슈      ${valueOrFallback(current.issue)}`,
    `│   상태      ${valueOrFallback(current.state)}`,
    `│   최근 결정 ${valueOrFallback(current.recent_decision)}`,
    `│   다음      ${valueOrFallback(current.next)}`,
  ];

  appendSourceSection(lines, source);

  // POK-327 — 실패 기록이 있을 때만 "지난 작업 멈춘 곳" 블록을 추가한다.
  // 없으면 기존 카드와 byte-identical (회귀 방지).
  const failureNotice = lifecycleCard.fields?.failure_notice;
  if (failureNotice) {
    lines.push(
      '│',
      '│ 지난 작업 멈춘 곳',
      `│   단계      ${valueOrFallback(failureNotice.stage)}`,
      `│   원인      ${valueOrFallback(failureNotice.reason)}`,
      `│   시도      ${valueOrFallback(failureNotice.attempt_line)}`,
    );
  }

  if (context.line) {
    lines.push(
      '│',
      '│ 컨텍스트',
      `│   ${context.line}`,
    );
  }

  lines.push(
    '│',
    '├─ 입력 대기',
    `│   ${valueOrFallback(inputWaiting.message, route.message)}`,
    `│   ${valueOrFallback(inputWaiting.guard, route.guard)}`,
    '╰─',
  );

  return stripRightSideBorders(lines.join('\n'));
}

export function renderPreExecutionPreviewCard({ previewCard = {} } = {}) {
  const current = previewCard.fields?.current ?? {};
  const preview = previewCard.fields?.preview ?? {};
  const inputWaiting = previewCard.fields?.input_waiting ?? {};

  return stripRightSideBorders([
    '╭─ ⚠️ POKit2 실행 전 확인',
    '│',
    '│ 이슈',
    `│   번호      ${valueOrFallback(current.issue)}`,
    `│   제목      ${valueOrFallback(current.title)}`,
    '│',
    '│ 미리보기',
    `│   목적      ${valueOrFallback(preview.purpose)}`,
    `│   사용자 개선 ${valueOrFallback(preview.user_improvement)}`,
    `│   이전 문제 ${valueOrFallback(preview.before)}`,
    `│   이후 해결 ${valueOrFallback(preview.after)}`,
    '│',
    '├─ 선택',
    `│   ${valueOrFallback(inputWaiting.message, 'a) 수동  b) 자동  c) 중단')}`,
    `│   ${valueOrFallback(inputWaiting.guard, '선택 전에는 파일 수정, 게이트 통과, 외부 쓰기를 하지 않습니다.')}`,
    '╰─',
  ].join('\n'));
}

export function renderExecutionReasoningChecklistCard({ checklist = {} } = {}) {
  const fields = checklist.fields ?? {};

  const lines = [
    '╭─ 🧠 POKit2 실행 추론 체크',
    '│',
    '│ 승인',
    `│   경로      ${valueOrFallback(fields.selected_skill)}`,
    `│   이슈      ${valueOrFallback(fields.active_issue)}`,
    `│   게이트    ${valueOrFallback(fields.gate_state)}`,
    `│   승인 입력 ${valueOrFallback(fields.execution_approval)}`,
    `│   모드      ${formatExecutionMode(fields.mode)}`,
    '│',
    '│ 작업 방식',
    `│   워커 권한 ${formatWorkerAuthorization(fields.worker_authorization)}`,
    `│   워커 판단 ${formatWorkerAvailability(fields.worker_availability)}`,
    `│   fallback ${valueOrFallback(fields.fallback_reason)}`,
  ];

  // POK-247 (AC1) — show the 🟢 자동 / 🔴 사람 확인 plan for the upcoming steps.
  if (Array.isArray(fields.safe_step_plan) && fields.safe_step_plan.length > 0) {
    lines.push('│', '│ 다음 단계 (🟢 자동 / 🔴 사람 확인)');
    for (const step of fields.safe_step_plan) {
      lines.push(`│   ${step.emoji} ${valueOrFallback(step.label)}`);
    }
  }

  lines.push(
    '│',
    '├─ 실행 전 계획',
    `│   리뷰      ${valueOrFallback(fields.post_change_review_plan)}`,
    `│   검증      ${valueOrFallback(fields.verification_plan)}`,
    `│   다음      ${valueOrFallback(fields.next_step)}`,
    '╰─'
  );

  return stripRightSideBorders(lines.join('\n'));
}

export function renderProgressCard({ progressCard = {} } = {}) {
  const current = progressCard.fields?.current ?? {};
  const next = progressCard.fields?.next ?? {};
  const source = progressCard.source ?? progressCard.fields?.source;

  const lines = [
    '╭─ 🔄 POKit2 작업 진행 중',
    '│',
    '│ 현재',
    `│   이슈    ${valueOrFallback(current.issue)}`,
    `│   단계    ${valueOrFallback(current.step)}`,
    `│   상태    ${valueOrFallback(current.state)}`,
  ];

  appendSourceSection(lines, source);

  lines.push(
    '│',
    '├─ 다음',
    `│   ${valueOrFallback(next.action)}`,
    '╰─',
  );

  return stripRightSideBorders(lines.join('\n'));
}

export function renderCompleteCard({ completeCard = {}, now = new Date() } = {}) {
  const result = completeCard.fields?.result ?? {};
  const changes = completeCard.fields?.changes ?? {};
  const verification = completeCard.fields?.verification ?? {};
  const next = completeCard.fields?.next ?? {};

  const completedAt = result.completed_at ? formatKst(new Date(result.completed_at)) : formatKst(now);

  const lines = [
    '╭─ ✅ POKit2 작업 완료',
    '│',
    '│ 결과',
    `│   이슈    ${valueOrFallback(result.issue)}`,
    `│   상태    ${valueOrFallback(result.state)}`,
    `│   완료    ${completedAt}`,
    '│',
    '│ 변경',
    `│   ${valueOrFallback(changes.summary)}`,
    '│',
    '│ 검수',
    `│   tests   ${valueOrFallback(verification.tests)}`,
    `│   doctor  ${valueOrFallback(verification.doctor)}`,
    `│   diff    ${valueOrFallback(verification.diff)}`,
  ];

  if (verification.commit) {
    lines.push(`│   commit  ${valueOrFallback(verification.commit)}`);
  }

  if (verification.evidence_path) {
    lines.push(`│   증거     ${valueOrFallback(verification.evidence_path)}`);
  }

  if (verification.verified_at) {
    lines.push(`│   검수일시 ${formatKst(new Date(verification.verified_at))}`);
  }

  lines.push(
    '│',
    '├─ 다음',
    `│   ${valueOrFallback(next.action)}`,
    '╰─',
  );

  return stripRightSideBorders(lines.join('\n'));
}

export function renderBlockedCard({ blockedCard = {} } = {}) {
  const current = blockedCard.fields?.current ?? {};
  const next = blockedCard.fields?.next ?? {};

  return stripRightSideBorders([
    '╭─ ⚠️ POKit2 확인 필요',
    '│',
    '│ 현재',
    `│   이슈    ${valueOrFallback(current.issue)}`,
    `│   상태    ${valueOrFallback(current.state)}`,
    `│   이유    ${valueOrFallback(current.reason)}`,
    '│',
    '├─ 다음',
    `│   ${valueOrFallback(next.action)}`,
    '╰─',
  ].join('\n'));
}

export function renderSprintCloseSummaryCard({ summaryCard = {}, now = new Date() } = {}) {
  const sprint = summaryCard.fields?.sprint ?? {};
  const stats = summaryCard.fields?.stats ?? {};
  const next = summaryCard.fields?.next ?? {};

  return stripRightSideBorders([
    `╭─ 🎉 POKit2 ${valueOrFallback(sprint.name, '스프린트')} 완료`,
    '│',
    '│ 종료',
    `│   스프린트  ${valueOrFallback(sprint.name)}`,
    `│   일시      ${formatKst(now)}`,
    `│   이슈      ${valueOrFallback(stats.issues)}`,
    `│   테스트    ${valueOrFallback(stats.tests)}`,
    '│',
    '├─ 다음',
    `│   ${valueOrFallback(next.action)}`,
    '╰─',
  ].join('\n'));
}

export function renderSessionCloseCard({ closeCard = {}, now = new Date() } = {}) {
  const close = closeCard.fields?.close ?? {};
  const handoff = closeCard.fields?.handoff ?? {};
  const source = closeCard.source ?? closeCard.fields?.source;

  const lines = [
    '╭─ 🧭 POKit2 세션 종료',
    '│',
    '│ 종료',
    `│   일시    ${formatKst(now)}`,
    `│   이슈    ${valueOrFallback(close.issue)}`,
    `│   상태    ${valueOrFallback(close.state)}`,
  ];

  appendSourceSection(lines, source);

  lines.push(
    '│',
    '├─ 인계',
    `│   다음    ${valueOrFallback(handoff.next)}`,
    `│   시작    ${quote(valueOrFallback(handoff.start, '포킷 시작'))}`,
    '╰─',
  );

  return stripRightSideBorders(lines.join('\n'));
}

function formatKst(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} KST`;
}

function quote(value) {
  return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
}

function valueOrFallback(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatExecutionMode(value) {
  if (value === 'automatic') return '자동';
  if (value === 'manual-confirm') return '수동 확인';
  return valueOrFallback(value);
}

function formatWorkerAuthorization(value) {
  if (value === 'authorized') return '허용됨';
  if (value === 'not_required') return '필요 없음';
  return valueOrFallback(value);
}

function formatWorkerAvailability(value) {
  if (value === 'dispatch_allowed') return 'fan-out 가능';
  if (value === 'not_authorized') return '권한 없음';
  return valueOrFallback(value);
}

function appendSourceSection(lines, source) {
  const rows = normalizeSourceRows(source);
  if (rows.length === 0) return;

  lines.push(
    '│',
    '│ 출처',
    ...rows.map(({ label, detail }) => `│   ${label}${detail ? `  ${detail}` : ''}`),
  );
}

function normalizeSourceRows(source) {
  if (!source) return [];

  if (typeof source === 'string') {
    return [{ label: normalizeSourceLabel(source), detail: '' }];
  }

  if (Array.isArray(source)) {
    return source.flatMap((item) => normalizeSourceRows(item));
  }

  if (typeof source === 'object') {
    if ('label' in source || 'type' in source || 'source' in source) {
      return [{
        label: normalizeSourceLabel(source.label ?? source.type ?? source.source),
        detail: valueOrFallback(source.detail ?? source.description, ''),
      }];
    }

    return Object.entries(source).map(([label, detail]) => ({
      label: normalizeSourceLabel(label),
      detail: valueOrFallback(detail, ''),
    }));
  }

  return [];
}

function normalizeSourceLabel(label) {
  const normalized = valueOrFallback(label, '').trim().toLowerCase();
  if (normalized === 'llm' || normalized === 'llm 판단' || normalized === 'llm-judgment') {
    return 'LLM 판단';
  }
  if (normalized === 'hook') return 'hook';
  if (normalized === 'runner') return 'runner';
  if (normalized === 'human') return 'human';
  return valueOrFallback(label);
}

function deriveStartupRoute(state) {
  const text = valueOrFallback(state, '').toLowerCase();
  if (text.includes('gate_passed')) {
    return {
      message: '"진행해줘" → /pokit.next 로 다음 후보 전환.',
      guard: '애매하면 /pokit.clarify 로 AC/범위를 먼저 정리합니다.',
    };
  }
  if (text.includes('pending')) {
    return {
      message: '"진행해줘" → /pokit.issue 로 현재 이슈 실행.',
      guard: '애매하면 /pokit.clarify 로 AC/범위를 먼저 정리합니다.',
    };
  }
  return {
    message: '현재 상태가 애매하면 /pokit.clarify 로 먼저 정리합니다.',
    guard: '확인 전에는 이슈 생성, 파일 수정, 게이트 실행을 하지 않습니다.',
  };
}

function stripRightSideBorders(value) {
  return value.replace(RIGHT_SIDE_BORDERS, '');
}
