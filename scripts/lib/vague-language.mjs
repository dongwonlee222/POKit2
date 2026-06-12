// POK-119 AC Quality Doctor Enforcement
// vague language 패턴 목록 및 감지 유틸리티

export const VAGUE_LANGUAGE_PATTERNS = [
  '적절히', '필요에 따라', '어느 정도', '충분히', '가능하면', '적당히',
];

// AC 섹션 텍스트에서 vague language 패턴을 찾아 반환
// 괄호 안 내용(예시/문서용 목록)은 제외하고 검사
export function findVagueLanguage(text) {
  const cleanedText = text.replace(/\([^)]*\)/g, '');
  return VAGUE_LANGUAGE_PATTERNS.filter((pattern) => cleanedText.includes(pattern));
}
