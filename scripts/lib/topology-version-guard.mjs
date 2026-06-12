// POK-340 — 토폴로지 버전 드리프트 감지 (순수 함수 — fs 접근 없음).
//
// 두 가지 검사를 제공한다:
//   1. checkPokitVersionDrift  — current.md frontmatter의 pokit_version과 실제 패키지 버전 비교.
//   2. checkSchemaVersionKnown — current.md frontmatter의 schema_version이 알려진 버전 목록에 있는지 확인.
//
// 두 함수 모두 텍스트 입력만 받고 파일 시스템에 접근하지 않는다.
// parseFrontmatter는 기존 issue-frontmatter.mjs를 재사용한다.

import { parseFrontmatter } from './issue-frontmatter.mjs';

/**
 * doctor와 pokit-update가 공유하는 알려진 상태 스키마 버전 목록.
 * 본체가 모르는 스키마를 만나면 조용히 진행하지 않고 거부한다 (§4 git repositoryformatversion 원칙).
 */
export const KNOWN_SCHEMA_VERSIONS = ['0.1.0'];

/**
 * current.md frontmatter의 pokit_version과 실제 패키지 버전을 비교해 드리프트를 감지한다.
 *
 * @param {{ currentMdText: string, packageVersion: string }} params
 * @returns {{ status: 'absent' | 'match' | 'drift', projectVersion: string | null }}
 *
 * status 의미:
 *   'absent'  — frontmatter에 pokit_version 필드가 없음 (토폴로지 이전 프로젝트 — 정상)
 *   'match'   — 프로젝트 기록 버전과 패키지 버전이 일치
 *   'drift'   — 버전 불일치 — pokit update 실행 필요
 */
export function checkPokitVersionDrift({ currentMdText, packageVersion }) {
  const frontmatter = parseFrontmatter(currentMdText);
  const rawVersion = frontmatter.pokit_version;

  // 필드 없거나 null이면 absent (이전 프로젝트)
  if (rawVersion === undefined || rawVersion === null || rawVersion === true) {
    return { status: 'absent', projectVersion: null };
  }

  const projectVersion = String(rawVersion).trim();
  if (!projectVersion) {
    return { status: 'absent', projectVersion: null };
  }

  const status = projectVersion === String(packageVersion).trim() ? 'match' : 'drift';
  return { status, projectVersion };
}

/**
 * current.md frontmatter의 schema_version이 KNOWN_SCHEMA_VERSIONS 목록에 있는지 확인한다.
 * frontmatter가 없거나 schema_version 필드가 없으면 known: true 취급 (구버전 관대).
 *
 * @param {{ currentMdText: string, knownVersions?: string[] }} params
 * @returns {{ known: boolean, schemaVersion: string | null }}
 */
export function checkSchemaVersionKnown({ currentMdText, knownVersions = KNOWN_SCHEMA_VERSIONS }) {
  const frontmatter = parseFrontmatter(currentMdText);
  const rawVersion = frontmatter.schema_version;

  // 필드 없거나 null/true이면 구버전 관대 처리 — known: true
  if (rawVersion === undefined || rawVersion === null || rawVersion === true) {
    return { known: true, schemaVersion: null };
  }

  const schemaVersion = String(rawVersion).trim();
  if (!schemaVersion) {
    return { known: true, schemaVersion: null };
  }

  const known = knownVersions.includes(schemaVersion);
  return { known, schemaVersion };
}
