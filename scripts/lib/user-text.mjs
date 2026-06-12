// User-facing text policy (POK-237).
//
// POKit keeps internal field/event names in English inside files, logs, and
// structured output. User surfaces (startup card, skill responses) must show
// plain Korean instead of raw internal tokens. This is the render-stage filter
// referenced by POK-237 AC5: the chokepoint where internal status text is
// converted before it reaches the PO-facing card.
//
// "영수증 → 기록" follows .ai-os/standards/terminology.md
// ("Do not use receipt / 영수증 as the default user-facing term. Prefer 기록").

function mapGateState(_match, word) {
  const w = (word || '').toLowerCase();
  if (w === 'gate_passed') return '완료(게이트 통과)';
  if (w === 'pending' || w === 'in_progress') return '진행 중';
  if (w === 'blocked') return '막힘';
  if (w === 'candidate' || w === 'accepted') return '대기 중';
  return '상태 확인';
}

// Order matters: gate_state mapping consumes any trailing "/ status: X" first.
// Filter coverage must be a superset of FORBIDDEN_USER_TOKEN_PATTERNS so that
// anything the detector flags is also something the filter can clean (POK-237
// review fix: keep detector and filter symmetric).
// POK-246 (AC4) — multi-session internal tokens must not reach a user surface.
// session_id (ses_…), the worktree branch that carries it, worktree/shared-state
// paths, and lock internals (holder/lease) are operational identifiers, not PO
// language. Order matters: the worktree-path and branch rules run BEFORE the bare
// session_id rule so the whole path/branch token is replaced as one unit instead
// of leaving a dangling entropy suffix. The display alias (S001) and issue ids
// (POK-XXX) are intentionally NOT filtered — they are PO-readable proper nouns.
const PLAINIFY_RULES = [
  [/gate_state\s*:\s*([a-z_]+)?(?:\s*\/\s*status:\s*[a-z_]+)?/gi, mapGateState],
  [/\bcandidates\s*잔여(?:\s*(\d+))?/gi, (_m, n) => (n ? `남은 후보 ${n}` : '남은 후보')],
  [/\bnpm test\s*\d+\/\d+/gi, '테스트 통과'],
  [/\bdoctor\s+fail\s*0\b/gi, '자동 점검 통과'],
  [/\bdoctor\s+fail\s*([1-9]\d*)\b/gi, '자동 점검 $1건 실패'],
  [/\bfan-?out\b/gi, '작업 나눔'],
  [/\S*-worktrees\/\S*/g, '작업공간'],
  [/\S*\.pokit\/sessions\/\S*/g, '세션 기록'],
  [/\S*\.git\/pokit\/\S*/g, '세션 공유 상태'],
  [/\bpokit\/[^\s/]+\/[A-Za-z]+-\d{3}\/ses_\w+/g, '이 세션 브랜치'],
  [/\bses_\w{6,}\b/g, '이 세션'],
  [/\b(?:lease_expiry|acquired_at|lock_id|holder)\b\s*[:=]\s*\S+/gi, '락 정보'],
  [/영수증/g, '기록'],
];

/**
 * Convert internal status text into plain user-facing Korean.
 * Pure and idempotent for already-plain text. Preserves issue IDs (POK-XXX).
 * Returns null/undefined unchanged so callers can pass optional fields.
 */
export function plainifyUserText(text) {
  if (text === null || text === undefined) return text;
  let out = String(text);
  for (const [pattern, replacement] of PLAINIFY_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// Tokens that must never appear on a user-facing surface (POK-237 AC4).
// Issue IDs (POK-XXX) are intentionally NOT forbidden — they are proper nouns.
export const FORBIDDEN_USER_TOKEN_PATTERNS = [
  { name: 'gate_state', pattern: /gate_state\s*:/i },
  { name: 'fan-out', pattern: /\bfan-?out\b/i },
  { name: 'candidates 잔여', pattern: /candidates\s*잔여/i },
  { name: 'npm test N/N', pattern: /\bnpm test\s*\d+\/\d+/i },
  { name: 'doctor fail N', pattern: /\bdoctor\s+fail\s*\d+/i },
  { name: '영수증', pattern: /영수증/ },
  // POK-246 (AC4) — multi-session internal tokens (each has a symmetric PLAINIFY rule above).
  { name: 'session_id', pattern: /\bses_\w{6,}\b/i },
  { name: 'session branch', pattern: /\bpokit\/[^\s/]+\/[A-Za-z]+-\d{3}\/ses_/i },
  { name: 'worktree path', pattern: /(?:\S*-worktrees\/|\.pokit\/sessions\/|\.git\/pokit\/)/i },
  { name: 'lock internals', pattern: /\b(?:lease_expiry|acquired_at|lock_id|holder)\s*[:=]/i },
];

/**
 * Return the names of forbidden user-facing tokens found in text.
 * Empty array means the text is clean for a user surface.
 */
export function findForbiddenUserTokens(text) {
  const value = String(text ?? '');
  return FORBIDDEN_USER_TOKEN_PATTERNS
    .filter(({ pattern }) => pattern.test(value))
    .map(({ name }) => name);
}
