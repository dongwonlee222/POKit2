# Review Lane Presets

Use these read-only lanes when a Harness Issue needs multi-perspective subagent verification.

## mvp_scope

Purpose: check MVP boundary and deferred scope.

Checks:

- L0/L1/L2-entry 범위 안인가.
- 후속 버전으로 미룰 dashboard/search/automation/external integration이 섞였나.
- 설계 이슈가 구현을 침범했나.

## pokit_identity

Purpose: check POKit v2 identity.

Checks:

- local-first인가.
- public-first인가.
- `.ai-os`가 source of truth인가.
- PO가 자연어로 시작하고 확인할 수 있는가.
- 회사 내부 경로, 개인 계정, 특정 SaaS에 의존하지 않는가.

## over_design

Purpose: check unnecessary complexity and token/read burden.

Checks:

- 파일 수와 read path가 늘어나는 이유가 명확한가.
- nullable slot을 실제 수집/계산 요구로 착각하지 않았나.
- full tracing, dashboard, semantic search, 자동 비용 계산으로 번지지 않았나.

## verification

Purpose: check completion evidence.

Checks:

- fresh verification command가 있는가.
- subagent 결과만으로 parent issue 완료를 주장하지 않았나.
- gate evidence와 next action이 남았나.
