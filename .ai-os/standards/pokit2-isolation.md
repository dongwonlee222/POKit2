# POKit2 격리 규칙 (개발 환경 전용)

이 파일은 **POKit2 개발자의 로컬 환경**(글로벌 `~/.claude/CLAUDE.md`에 POKit1·Nexus 운영 규약이 박혀 있는 환경)에서 글로벌 컨텍스트가 POKit2 작업에 침투하지 않도록 막는 가드 문서입니다.

이 파일은 `starter-manifest.yaml`에 포함되지 않으므로 외부 starter 사용자에게 배포되지 않습니다. 외부 사용자에게는 의미 없는 내용이기 때문입니다.

## 무시할 컨텍스트

- `~/workspace/CLAUDE.md`의 **pokit/ 관련 규칙** (POKit1 전용 — "포킷 시작"·`./bin/pokit` 등)
- `~/.claude/CLAUDE.md`의 **POKit1 운영 규약** (Linear cycle/version, backlog-memo, dry-run 박제, decision-log auto-append, 4섹션 백로그, 시각화 우선)
- POKit1 메모리(이전 워크스페이스의 auto-memory) — 참조·복사 금지

## 발동 금지 스킬·도구

- `current-context`, `save`, `handoff` (글로벌 PO 전용)
- `backlog-add`, `backlog-memo`, `backlog-view`, `backlog-sprint` (POKit1 전용)
- `linear-backlog-manager`, `linear-issue-manager`, Linear MCP 쓰기
- `pokit start` / `pokit brief` (POKit1 CLI)
- nexus 글로벌 메모리 인용

## 허용 도구

- 기본: Read·Write·Edit·Bash·Grep·Glob·TaskCreate
- POKit2 자체 스크립트: `scripts/pokit-*.mjs`, 테스트: `tests/*.mjs`
- 일반 개발 스킬: `tdd`, `debug`, `review`, `bs-detector`, `security-review`, `vs`, `isok`, `writing-plans`

## 메모리 분리

- auto-memory 경로: 각 환경의 `~/.claude/projects/<프로젝트-경로-슬러그>/memory/` (개인 경로 — 레포에 기록하지 않음)
- POKit2 자체 메모리만 작성·참조

## 빠른 참조

- 운영 계약: [`AGENTS.md`](../../AGENTS.md)
- 아키텍처: [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
- 로드맵: [`docs/v2/POKIT_V2_ROADMAP.md`](../../docs/v2/POKIT_V2_ROADMAP.md)
- 진입점: `.ai-os/current.md`
