import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

export const REQUIRED_SECTIONS = [
  { id: 1, title: '점검 방법' },
  { id: 2, title: '잘된 것' },
  { id: 3, title: '아쉬운 것' },
  { id: 4, title: '패턴 한 줄' },
  { id: 5, title: '다음에 바꿀 것' },
  { id: 6, title: '액션 아이템' },
  { id: 7, title: '이전 회고 검증' },
  { id: 8, title: '완료 목록' },
  { id: 9, title: '계획 대비 실제' },
];

const QUANTITATIVE_PATTERN = /\d+\s*(건|개|%|sprint|회|줄|byte|KB|MB|tokens?|문장|단어)/i;
const PREV_RETRO_TABLE_HEADER = /\|\s*Action[^|]*\|[^|]*상태[^|]*\|[^|]*증거[^|]*\|/i;
// §9 계획 대비 실제 delta 표: 항목 / 분류 / 증거 컬럼.
const DELTA_TABLE_HEADER = /\|\s*항목[^|]*\|[^|]*분류[^|]*\|[^|]*증거[^|]*\|/i;
// 분류 마커: 계획대로 / 추가 / 이월 / 드롭 중 ≥ 1개로 계획 대비 변화를 구분.
const DELTA_CLASS_MARKER = /(계획대로|추가|이월|드롭)/;

/**
 * Verify retro file against v2 schema.
 * @param {string} retroPath absolute path to retro.md
 * @param {object} options { skipReason?: string, poApprovalCommit?: string }
 * @returns {Promise<{ ok: boolean, fails: string[], warnings: string[] }>}
 */
export async function verifyRetroSchema(retroPath, options = {}) {
  const fails = [];
  const warnings = [];

  let exists = true;
  try {
    await access(retroPath);
  } catch {
    exists = false;
  }

  if (!exists) {
    if (options.skipReason && options.poApprovalCommit) {
      return { ok: true, fails, warnings: ['retro_skip_reason_accepted'] };
    }
    fails.push('retro_file_missing');
    return { ok: false, fails, warnings };
  }

  const text = await readFile(retroPath, 'utf8');

  // 1. 9섹션 헤더 모두 존재
  for (const section of REQUIRED_SECTIONS) {
    const headerRegex = new RegExp(`^##\\s+(${section.id}\\.?\\s+)?${escapeRegex(section.title)}`, 'm');
    if (!headerRegex.test(text)) {
      fails.push(`retro_section_missing:${section.id}_${section.title}`);
    }
  }

  // 2. 요건 7번 1:1 매핑 표 존재
  if (!PREV_RETRO_TABLE_HEADER.test(text)) {
    fails.push('retro_prev_action_table_missing');
  }

  // 3. 요건 3번 실증 인용 (정량 패턴) — warning
  const section3Match = text.match(/^##\s+(3\.?\s+)?아쉬운 것[\s\S]*?(?=\n##\s|$(?![\s\S]))/m);
  if (section3Match && !QUANTITATIVE_PATTERN.test(section3Match[0])) {
    warnings.push('retro_section3_no_quantitative_evidence');
  }

  // 4. 요건 9번 계획 대비 실제 delta 표 존재 + 분류 마커
  const section9Match = text.match(/^##\s+(9\.?\s+)?계획 대비 실제[\s\S]*?(?=\n##\s|$(?![\s\S]))/m);
  if (section9Match) {
    if (!DELTA_TABLE_HEADER.test(section9Match[0])) {
      fails.push('retro_delta_table_missing');
    } else if (!DELTA_CLASS_MARKER.test(section9Match[0])) {
      warnings.push('retro_delta_no_classification_marker');
    }
  }

  return { ok: fails.length === 0, fails, warnings };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve retro path for a given sprint version.
 * @param {string} repoRoot
 * @param {string} sprintVersion e.g. "v0.9.0"
 */
export function retroPathFor(repoRoot, sprintVersion) {
  return path.join(repoRoot, 'docs', sprintVersion, 'retro.md');
}

/**
 * Transitional immunity sprints (v0.5/0.6/0.7) — retro absence is expected.
 */
export const TRANSITIONAL_IMMUNE_SPRINTS = new Set(['v0.5.0', 'v0.6.0', 'v0.7.0']);

export function isTransitionalImmune(sprintVersion) {
  return TRANSITIONAL_IMMUNE_SPRINTS.has(sprintVersion);
}
