# Artifact Standard

- Durable work must have a Harness Issue unless it is a pre-issue operational artifact.
- Artifacts use frontmatter when they carry state.
- Completion evidence lives in verification or gate artifacts, not chat text.
- Stale artifacts must be marked stale instead of silently overwritten.

## 범위 결정 전 과설계 체크

새 이슈 생성, 기존 이슈 범위 확장, 새 표준 추가 전에 아래 항목을 확인한다. 하나라도 해당되면 이슈 대신 기존 파일 수정이나 대화로 처리한다.

- 기존 파일 수정으로 해결 가능하지 않은가?
- 패턴이 3번 반복되기 전에 추상화하려는 건 아닌가?
- 이 이슈가 없으면 실제로 무언가 막히는가?
- 범위가 gate 하나에서 끝나는가?
- doctor/test 없이 done 클레임하려는 건 아닌가?

## External Artifacts (POK-329)

저장소 밖에서 생성·보관되는 산출물(PDF, 디자인 파일, 외부 서비스 산출물 등)은
이슈 카드의 `## External Artifacts` 섹션에 기록한다. 저장소 파일은 기존
`produces:` frontmatter를 쓰고, 이 섹션은 저장소 경로로 추적 불가능한 것만 담는다.

엔트리 형식 (한 산출물당 한 블록):

```text
- location: <절대 경로 또는 URL>
  generated_by: <생성 도구/스킬 식별자>
  generated_at: <YYYY-MM-DD>
  checksum: <sha256 앞 16자리 | 미수집>
  verified: <검수 방법 한 줄 | 미검수>
  repro_input: <저장소 내 재현 입력 경로 | none>
```

규칙:

- `location`이 사라질 수 있는 외부 경로이므로, 재현 가능한 입력(`repro_input`)을
  저장소에 남기는 것을 우선한다 — 입력이 있으면 산출물은 다시 만들 수 있다.
- `checksum`/`verified`는 정직값 — 측정 안 했으면 "미수집"/"미검수"로 표기한다.
- doctor 강제 없음 (1호 실험 단계). 사용 사례 3건 누적 후 박제 여부를 재평가한다.

## Code Management

- issue-per-durable-change: durable code, contract, docs, or release work must be tied to one Harness Issue.
- small scoped changes: keep changes bounded to the active issue.
- tests before gate claim: add or update verification before claiming behavior, contract, or release state.
- no unrelated refactor: avoid cleanup, formatting churn, or structure moves that are not needed for the active issue.
- public-safe starter content: starter artifacts must avoid secrets, personal paths, private company assumptions, production history, run logs, and event receipts.
- review evidence before completion: use fresh local verification before completion (claim-boundary SSoT: `completion-claim.md` / `agent-invocation.md` — see `claim-boundary-ssot-map.md`).
- release notes or changelog boundary: user-facing release notes belong to an explicit release packaging issue.
