# Knowledge Store 설계 결정

> schema_version: 0.1.0
> decided_at: 2026-06-09
> decided_by: POK-321 (Opus 어드바이스 반영)
> status: active

---

## 1. 저장 위치 — 프로젝트 로컬

**결정: `.ai-os/knowledge/` (프로젝트 로컬)**

글로벌(`~/.ai-os/`) 채택하지 않는 이유:
- POKit2는 공개 레포 — 글로벌 경로에 개인 데이터가 섞일 위험
- Codex/Antigravity 런타임에서 `~/.ai-os/` 접근 불확실 (v0.17 범위 밖)
- 프로젝트 로컬로 시작하면 공개 레포 격리 문제 단순화

소비자 복수화 시(여러 프로젝트) 글로벌 저장소 설계는 별도 이슈로 재평가.

## 2. 디렉토리 레이아웃

```
.ai-os/knowledge/
├── specs/          ← /pokit.spec 산출물 (외부 제품 스펙 문서)
│   └── YYYYMMDD-slug.md
└── research/       ← 리서치 원자 단위 (벤치마킹, 사례 조사 등)
    └── YYYYMMDD-topic-slug.md
```

## 3. 공개 레포 격리 규칙

**개인 데이터(이름, 이메일, 계정 정보, 비밀 정보) 는 절대 `.ai-os/knowledge/`에 저장 금지.**

| 저장 위치 | 저장 내용 |
|---|---|
| `.ai-os/knowledge/` | 역할·규약·제품 스펙·리서치 결과 (비개인, 레포 트래킹 가능) |
| `~/.claude/projects/.../memory/` | 세션 메모리, 개인 컨텍스트 (레포 트래킹 안 함) |

## 4. 신선도 정책

**결정: `researched_at` 필드 포함 + 단일 정책**

- 모든 knowledge 파일 frontmatter에 `researched_at: YYYY-MM-DD` 필수
- 단일 정책: 6개월 초과 시 stale 후보로 간주 (자동 만료 없음, 수동 갱신)
- TTL 주제별 세분화는 후속 이슈

## 5. 중복 방지 방향

**결정: slug 기반 키 + 덮어쓰기(changelog 보존)**

- 파일명 = `YYYYMMDD-{slug}.md` (slug = 주제 핵심 키워드 kebab-case)
- 동일 주제 재작성 시: 파일 덮어쓰기 + 파일 내 `## 변경 이력` 섹션에 이전 요약 보존
- 상세 병합 알고리즘은 후속 이슈

## 6. 스펙 vs 리서치 구분

| 종류 | 경로 | 용도 |
|---|---|---|
| 제품 스펙 | `specs/` | `/pokit.spec` 산출물. Brief+Evidence+AC 구조. PM/PO 의사결정 문서 |
| 리서치 | `research/` | 벤치마킹, 사례 조사, 외부 도구 분석. 원자 단위 지식 |

벤치마킹(정량값)과 일반 지식(정성 통찰)은 같은 `research/` 폴더 사용.
구분이 필요하면 파일명 prefix(`bench-`, `insight-`) 로 관리.

## 7. /pokit.spec 연결 계약

`/pokit.spec` 스킬이 본 저장소를 사용하는 방식:

- **쓰기**: `.ai-os/knowledge/specs/YYYYMMDD-{slug}.md` 생성/갱신 (PO 승인 후)
- **읽기**: 동일 주제 기존 스펙 조회 후 중복 여부 확인 (`specs/` 검색)
- **포맷**: 아래 § 스펙 문서 포맷 준수

## 8. 스펙 문서 포맷

파일: `.ai-os/knowledge/specs/YYYYMMDD-{slug}.md`

```markdown
---
knowledge_type: product_spec
slug: {slug}
title: "{제품명} 스펙"
status: draft | reviewed | archived
created_at: YYYY-MM-DD
researched_at: YYYY-MM-DD
spec_version: 1
---

# {제품명} 스펙

## 요약
한 줄 요약.

## 대상 사용자 & 고통
- 타깃 사용자:
- 핵심 고통:

## 문제 정의
- 현재 상태:
- 원하는 상태:

## 성공 지표
1. (측정 가능 지표)
2.
3.

## 범위
포함:
- ...

비포함:
- ...

## 미결 질문
- ...

## 변경 이력
- YYYY-MM-DD: 최초 작성
```

## 9. 후속 구현 이슈 후보

이 문서에서 파생되는 후속 이슈:
- POK-321 산출물: `/pokit.spec` 스킬 구현 (본 이슈)
- 소비자 복수화 시: 글로벌 저장소 설계 별도 이슈
- 자동 캡처 실행흐름: 워커 트리거 구현 별도 이슈
- 신선도 자동 관리: stale 탐지 + 갱신 알림 별도 이슈

## Non-Scope (이 문서에서 결정하지 않는 것)

- 자동 캡처 실행흐름 / 워커 트리거 코드 구현
- TTL 구체값, 병합 알고리즘 상세
- DuckDB 분석 레이어 (v3 씨앗)
- Codex/Antigravity 런타임 글로벌 경로 호환
- `/pokit.spec` write API 시그니처 상세 (POK-321 소관)
