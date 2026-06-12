# Engineering Standards

Applies to all `.mjs` files in `scripts/` and `tests/`. Enforced by code review, tests, and doctor checks.

## 파일 구조

- 파일 상단: shebang(`#!/usr/bin/env node`) → import → 상수 → export function 순.
- 파일 하나가 하나의 책임을 갖는다. 복수 책임이 생기면 `scripts/lib/`으로 분리.
- `scripts/lib/*.mjs` — pure 함수, 사이드이펙트 없음, testable.
- `scripts/pokit-*.mjs` — runner/CLI entry. `lib/` 모듈을 조합해 실행.

## 명명

- 함수: camelCase (`checkDependsOnCycles`, `renderStartupLifecycleCard`).
- 상수: UPPER_SNAKE_CASE (`STATUS_ENUM`, `ISSUE_FILE_PATTERN`).
- 파일: kebab-case (`issue-paths.mjs`, `lifecycle-card-renderer.mjs`).
- 불리언 반환 함수: `is*` / `has*` / `check*` 접두어.

## 임포트

- Node.js 내장 모듈은 반드시 `node:` 프로토콜 사용 (`import { readFile } from 'node:fs/promises'`).
- 사용하지 않는 import는 제거 (`no-unused-vars`).
- 상대 경로 임포트만 사용. npm 런타임 의존성 추가 금지.

## 에러 처리

- 빈 catch 블록은 의도적인 fallback 패턴에만 허용. 이 경우 호출부에서 명확한 맥락이 있어야 한다.
- 사용자에게 노출되는 에러 메시지는 한국어.
- `process.exit(1)` — 치명적 오류 시만 사용. doctor·runner 스크립트에만 허용.

## 테스트

- 모든 `scripts/lib/*.mjs` 함수는 `tests/` 에 대응하는 test 파일을 갖는다.
- 테스트는 `node:test` + `node:assert/strict` 사용.
- active_issue, gate_state, canonical_state 등 전환성 상태는 `tests/lib/test-fixtures.mjs`를 통해 동적으로 읽는다 (AFR-004).

## 검증

- `node --test tests/*.mjs` → 전체 pass.
- `node scripts/pokit-doctor.mjs` → pass.
- PR 병합 전 체크리스트는 `.github/PULL_REQUEST_TEMPLATE.md` 참고.
