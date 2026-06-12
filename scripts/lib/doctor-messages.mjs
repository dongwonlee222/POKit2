export const DOCTOR_GUIDANCE_BY_CHECK = {
  current_exists: '.ai-os/current.md를 복구하거나 다시 작성한 뒤 doctor를 재실행하세요.',
  current_frontmatter: 'current.md frontmatter에 누락된 필드를 채우고, 다음 행동이 한 줄로 읽히는지 확인하세요.',
  start_read_order: 'start_read_order를 AGENTS.md, current.md, handoff.md, startup-communication.md 4개로 되돌리세요.',
  work_read_order: 'work_read_order에 누락된 파일을 추가하고 실제 파일 존재 여부까지 확인하세요.',
  work_read_file_exists: 'work_read_order에 적힌 파일을 생성하거나 경로를 현재 구조에 맞게 고치세요.',
  active_issue_exists: 'active_issue 카드 파일을 복구하거나 current.md의 active_issue 값을 실제 카드로 맞추세요.',
  active_issue_section: '이슈 카드에 누락된 필수 섹션을 추가하고, 빈 섹션이면 최소 판단 근거를 채우세요.',
  simplicity_checklist: 'Simplicity Checklist 4질문(PO가 새 단어 외워야? / 카드 한 화면? / doctor 자동 검출? / 흐름 짧아짐?)에 대한 증거를 해당 표면에 남기세요.',
};

const MESSAGE_GUIDANCE_PATTERNS = [
  {
    pattern: /missing|required|누락|없|is missing/i,
    guidance: '해당 파일이나 섹션의 누락된 내용을 복구하고 doctor를 다시 실행하세요.',
  },
  {
    pattern: /drift|differs|mismatch|일치/i,
    guidance: '서로 다른 상태 표면을 source-of-truth 기준으로 맞춘 뒤 doctor를 다시 실행하세요.',
  },
  {
    pattern: /invalid|not valid|위반/i,
    guidance: '표준 형식에 맞게 값을 고치고, 같은 체크가 pass로 바뀌는지 확인하세요.',
  },
];

export function resolveDoctorGuidance({ check, message = '' } = {}) {
  if (check && DOCTOR_GUIDANCE_BY_CHECK[check]) {
    return DOCTOR_GUIDANCE_BY_CHECK[check];
  }

  const matched = MESSAGE_GUIDANCE_PATTERNS.find(({ pattern }) => pattern.test(message));
  if (matched) return matched.guidance;

  return '관련 표준과 해당 파일을 함께 확인해 원인을 고치고 doctor를 다시 실행하세요.';
}
