# Governance Core — 반드시 유지하는 통제 장치

> POK-328 (2026-06-10, PO 승인). 판단 기준: **"이 장치가 없어지면 사람이 잃는 게
> 통제력인가, 절차인가"** — 통제력이면 유지, 절차면 교체/폐기.
> 이 문서는 다이어트(검사/지시문 축소) 작업에서 **폐기 금지 경계**의 SSoT다.

## 코어 5축 (폐기 금지)

1. **이슈 강제** — Harness Issue 없이 durable 작업 금지. 추적 불가능한 변경 차단.
   (검사 가족: issue_authoring_evidence, backlog_routing_decision, preflight)
2. **게이트 승인** — gate_passed는 사람 승인 + 신선한 검증 증거 + 영수증 사슬로만.
   (검사 가족: checkpoint chain·backfill 탐지, gate_claim_vs_frontmatter,
   verification_ready 선행 강제, 게이트 증거 검사)
3. **정직 메트릭** — 실측값 우선, 미수집은 미수집으로. 가짜 0·소급 기록 금지.
   (검사 가족: metrics_duration_zero, v010_metrics_evidence, fanout_metrics_consistency)
4. **상태 외부화** — current/status-board/handoff/release-scope/카드 간 정합.
   세션이 죽어도 상태가 산다. (검사 가족: next_action_consistency,
   release_scope_status_vs_frontmatter, read-order 정합)
5. **회고 체인** — 실패 기록 → 예방 규칙 → 라우팅의 정합. 같은 실수 반복 차단.
   (검사 가족: failure_memory_consistency, retro_schema_compliance)

추가 코어 (5축 밖이지만 통제력): 시크릿 경계(pokit_config_secret_boundary),
워커 쓰기범위 안전(sub_issue_* 8종), 계약 토큰 drift(command/skill drift 검사 —
지시문 압축 시 핵심 계약 보존의 안전망).

## 다이어트 원칙 (POK-328에서 박제)

- **문구 존재 확인(자기신고)은 통제력이 아니다** — 강한 모델일수록 "맞는 문장
  써 넣기"가 쉬워 차단 효과 0, 비용만 남는다. 행동/일관성 검사로 교체하거나 폐기.
- **늘 우는 경보는 경보가 아니다** — 무조건 warn은 무시를 훈련시킨다. 폐기.
- **건너뜀(skip)은 소리가 나지 않는다** — 검사는 "몇 건을 들여다봤는지"를 세고,
  대상이 있는데 0건 점검이면 죽은 검사로 경고한다 (check_coverage 메타 검사).
- **카드 필드 읽기는 길목 하나로** — 검사마다 frontmatter를 제각각 읽으면 필드명
  변경 때 조용히 죽는다. 공용 접근자(예: resolveIssueSprint)를 쓴다.
- 검사 수는 지표가 아니다. **살아있는 검사**만 통제력이다.

## 폐기 기록 (2026-06-10, 15건)

L2 참조런 박물관 8건 / runtime_proof 상시 warn 3건 / simplicity_checklist /
net_deletion_accounting_standard / failure_read_gate / deferred_to_X_regression.
근거와 전수 분류표는 POK-328 카드 참조.
