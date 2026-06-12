#!/usr/bin/env node
// POK-340 — pokit update CLI
//
// 사용법: node scripts/pokit-update.mjs [--root <dir>] [--yes]
//
// 동작:
//   1. 프로젝트 .ai-os/current.md를 읽어 schema_version을 확인한다.
//      모르는 스키마면 exit 1 + 한국어 안내 (조용히 진행하지 않음 — §4 원칙).
//   2. 기본 (--yes 없음): 미리보기 — 도구 소유 재생성 대상 목록 + 보존 목록을 JSON으로 출력, 쓰기 0.
//   3. --yes: writeResidue(regenerate: true) + writeProjectPokitVersion(현재 패키지 버전) 실행.
//      사용자 소유(.ai-os/ 전체, 마커 밖 본문)는 절대 건드리지 않는다.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  checkSchemaVersionKnown,
  KNOWN_SCHEMA_VERSIONS,
} from './lib/topology-version-guard.mjs';
import { resolvePackageRoot, readPokitPackageVersion } from './lib/pokit-config.mjs';
import { writeResidue, writeProjectPokitVersion } from './lib/pokit-topology.mjs';

const PACKAGE_ROOT = resolvePackageRoot();

// --------------------------------------------------------------------------
// CLI 인수 파싱
// --------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { root: process.cwd(), yes: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      args.root = path.resolve(argv[++i]);
    } else if (argv[i] === '--yes') {
      args.yes = true;
    }
  }
  return args;
}

// --------------------------------------------------------------------------
// current.md 읽기 (없으면 null)
// --------------------------------------------------------------------------
async function readCurrentMd(root) {
  const filePath = path.join(root, '.ai-os', 'current.md');
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// 도구 소유 / 사용자 소유 분류 (미리보기용)
// spec §4 소유권 경계:
//   도구 소유: AGENTS.md 마커 블록 안, .claude/skills/pokit-*
//   사용자 소유: .ai-os/ 상태 전체, AGENTS.md 마커 밖 본문, 사용자 작업물
// --------------------------------------------------------------------------
function classifyOwnership() {
  return {
    toolOwned: [
      'AGENTS.md (마커 블록 내부)',
      '.claude/skills/pokit-* (스킬 지시문)',
    ],
    userOwned: [
      '.ai-os/ (전체 상태 — 절대 보존)',
      'AGENTS.md (마커 밖 본문 — 절대 보존)',
      '사용자 작업물 (커스텀 스크립트·설정 등)',
    ],
  };
}

// --------------------------------------------------------------------------
// 메인
// --------------------------------------------------------------------------
async function main() {
  const { root, yes } = parseArgs(process.argv);
  const packageVersion = await readPokitPackageVersion(PACKAGE_ROOT);

  // 1. current.md 읽기
  const currentMdText = await readCurrentMd(root);
  if (currentMdText === null) {
    console.error('[pokit update] .ai-os/current.md 파일을 찾을 수 없습니다.');
    console.error(`  경로: ${path.join(root, '.ai-os', 'current.md')}`);
    console.error('  해결: 포킷이 초기화된 프로젝트 루트에서 실행하거나 --root <경로>를 지정하세요.');
    process.exitCode = 1;
    return;
  }

  // 2. 스키마 버전 확인 — 모르는 스키마면 거부
  const { known, schemaVersion } = checkSchemaVersionKnown({ currentMdText });
  if (!known) {
    console.error('[pokit update] 알 수 없는 상태 스키마 버전입니다. 조용히 진행하지 않습니다.');
    console.error(`  감지된 schema_version: ${schemaVersion}`);
    console.error(`  지원 버전: ${KNOWN_SCHEMA_VERSIONS.join(', ')}`);
    console.error('');
    console.error('  이 버전의 포킷 본체는 이 프로젝트 상태 스키마를 알지 못합니다.');
    console.error('  마이그레이션 가이드를 확인하세요: docs/v0.19.0/topology-spec.md §4');
    console.error('  (git repositoryformatversion 원칙 — 모르는 포맷은 건드리지 않음)');
    process.exitCode = 1;
    return;
  }

  // 3. 미리보기 모드 (--yes 없음)
  if (!yes) {
    const { toolOwned, userOwned } = classifyOwnership();
    const preview = {
      mode: 'preview',
      packageVersion,
      projectRoot: root,
      schemaVersion: schemaVersion ?? '(없음 — 구버전 관대 처리)',
      willRegenerate: toolOwned,
      willPreserve: userOwned,
      writesPerformed: 0,
      note: '--yes 플래그를 추가하면 실제 업데이트를 실행합니다.',
    };
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  // 4. 실제 업데이트 (--yes)
  console.log('[pokit update] 도구 소유 파일 재생성 중...');
  const residueResult = await writeResidue(root, {
    packageRoot: PACKAGE_ROOT,
    version: packageVersion,
    regenerate: true,
  });
  console.log(JSON.stringify({
    written: residueResult.written,
    skipped: residueResult.skipped,
    preserved: residueResult.preserved,
  }, null, 2));

  // 프로젝트 버전 기록 갱신
  await writeProjectPokitVersion(root, packageVersion);
  console.log(`[pokit update] 완료 — 프로젝트 버전 기록 갱신: ${packageVersion}`);
  console.log('  사용자 소유(.ai-os/ 전체, 마커 밖 본문)는 보존되었습니다.');
}

main().catch((err) => {
  console.error('[pokit update] 예상치 못한 오류:', err.message);
  process.exitCode = 1;
});
