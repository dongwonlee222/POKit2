/**
 * 스타터 공유 모듈 — active_issue 없음 판정 + 자동초안 카드 렌더러.
 * PreToolUse 가드(예방 레버)가 재사용한다 — 이 파일을 직접 구현하지 말고 가져올 것.
 *
 * 설계 계약: starter safety floor contract (reasoning + prevention + detection)
 */

import path from 'node:path';

// 정확 패턴 통일(자릿수/접두)은 후속 SSoT 작업; 여기선 기존 prefix-agnostic 패턴 재사용
import { ISSUE_ID_PATTERN, readCurrent } from './pokit-project-contract.mjs';

/**
 * active_issue 없음 판정.
 *
 * .ai-os/current.md를 읽어 active_issue 필드가 ISSUE_ID_PATTERN에 매치하면 true.
 * 캐시 없음 — 매 호출마다 신선하게 읽는다 (설계 계약 AC3).
 *
 * @param {string} root - 프로젝트 루트 경로
 * @returns {Promise<boolean>}
 */
export async function hasActiveIssue(root) {
  try {
    const { frontmatter } = await readCurrent(root);
    const activeIssue = frontmatter.active_issue;
    if (!activeIssue || activeIssue === 'null') return false;
    return ISSUE_ID_PATTERN.test(String(activeIssue));
  } catch {
    // 읽기 실패(파일 없음 등) → active_issue 없음으로 처리 (fail-closed)
    return false;
  }
}

/**
 * 자동초안 카드 렌더러.
 *
 * 블로킹 메시지 + 이슈 초안 안내를 open-right ASCII 카드로 반환한다.
 * 러너(추론)와 훅(예방) 모두 이 함수를 호출한다.
 *
 * @param {{ workSummary?: string, suggestedTitle?: string }} context
 * @param {string} workSummary - 사용자가 요청한 작업 한 줄 설명 (없으면 context.workSummary 사용)
 * @returns {string}
 */
export function renderDraftCard(context = {}, workSummary = '') {
  const summary = workSummary || context.workSummary || '요청된 작업';
  const suggestedTitle = context.suggestedTitle ?? summary;

  return [
    '╭─ 이슈 연결 필요',
    '│',
    '│ 실행 전에 이슈를 먼저 묶어야 합니다.',
    '│ 이슈 없이 durable 작업(파일 수정·커밋·배포 등)을 진행할 수 없습니다.',
    '│',
    '│ 작업 요약',
    `│   ${summary}`,
    '│',
    '│ 자동 초안 (캡처급 / COM 버킷 권장)',
    `│   제목    ${suggestedTitle}`,
    '│   등급    캡처급 — 가볍고 즉흥적인 작업에 적합',
    '│           게이트급(spec/impl/AC 포함)이 필요하면 /pokit.backlog 사용',
    '│',
    '├─ 한 줄 확인',
    '│   위 초안 제목으로 이슈를 생성하려면:',
    '│   node scripts/pokit-issue-create.mjs --title "<제목>"',
    '│   그 후 node scripts/pokit-issue-use.mjs <이슈ID> 로 활성화',
    '╰─',
  ].join('\n');
}
