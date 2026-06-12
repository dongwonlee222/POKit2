---
id: artifact-lifecycle
schema_version: 0.1.0
status: active
created_at: 2026-05-23
---

# Artifact Lifecycle Contract

docs/, contracts/ 내 문서 artifact의 생명주기 필드 표준.
POK-092에서 도입. artifact 삭제 패턴을 반복 가능하게 만든다.

## Lifecycle Fields

| Field | Type | Description |
|---|---|---|
| `status` | `active \| archived` | 현재 lifecycle 상태 (기본값: active) |
| `archived_at` | `YYYY-MM-DD` | `archived`로 전환된 날짜 |
| `superseded_by` | file path or artifact id | 이 artifact를 대체하는 새 파일 또는 artifact id |

## Rules

- `status` 미기재 시 `active`로 간주한다.
- 삭제보다 `archived` 처리를 우선 고려한다.
- `archived_at` 없이 `status: archived`로 마크하면 doctor warning이 발생한다.
- 후계 파일이 있으면 `superseded_by`를 명시한다. 없어도 된다.
- `archived` artifact는 삭제 전에 참조 인덱스(artifact-index.md 등)를 정리한다.

## Gate Checklist for Deletion

이슈 Gate 섹션에 삭제/아카이브 항목이 있을 때 체크한다:

- [ ] 이 이슈가 대체하는 기존 파일이 있는가? (있다면 `superseded_by` 기록)
- [ ] 해당 파일의 lifecycle `status`를 `archived`로 업데이트했는가?
- [ ] `archived_at` 날짜를 기록했는가?
- [ ] 참조하는 링크나 인덱스에서 해당 파일 항목을 정리했는가?

## Frontmatter Example

```markdown
---
id: pokit-v020-release-spec
status: archived
archived_at: 2026-05-23
superseded_by: docs/v3/POKIT_V030_RELEASE_SPEC.md
---
```

## Active Example (no lifecycle fields needed)

```markdown
---
id: artifact-lifecycle
schema_version: 0.1.0
status: active
---
```
