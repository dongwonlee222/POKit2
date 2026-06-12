# Guard Priority Ladder Standard — 추론 우선 3단 사다리

가드/강제/검출을 설계할 때의 **투자 우선순위 원칙**. "무엇을 막을까"보다 "어디에 힘을 쓸까"를 정한다.

## 원칙 (3단 사다리)

위에서부터 투자한다. 아래 칸은 윗칸이 흘린 잔여물만 받는다.

1. **(1순위) LLM 추론·판단 극대화** — 올바른 경로를 가장 쉽고 환하게 만든다. 규칙 파일·맥락·좋은 안내/재안내 메시지로 모델이 *스스로* 정답 경로를 추론하게 한다. 차단 메시지는 "막기"가 아니라 "다음 추론을 세우기"가 목적이다.
2. **(2순위) 사전예방** — 추론으로 못 막는 것만 행동 전에 차단한다(훅·권한 게이트·길목). 드리프트(정직한 깜빡임)를 행동 전에 잡는다.
3. **(3순위) 탐지** — 예방도 못 막은 것만 사후에 비춘다(doctor·영수증·event-log). **탐지의 적대적 완벽성은 추구하지 않는다** — 범용 도구(쉘/인터프리터)를 쥔 에이전트의 의도 분류는 원리적으로 불가능(Rice 정리)하므로, 탐지는 "tamper-proof"가 아니라 "tamper-evident(흔적이 남는다)"가 목표다.

## 적용 범위 (정직한 라벨 — 과장 금지)

이 사다리는 **정확성/생산성 governance ordering이다. 보안 경계가 아니다.**

- **성립 조건(사다리 A):** 단일 신원 · 정직한 드리프트가 주 실패모드 · 복구 가능(git) · 강한 모델. POKit2가 정확히 이 regime.
- **역전 조건(사다리 B = 봉쇄 우선):** 적대적/미신뢰 입력(프롬프트 인젝션) · 멀티테넌트 · 자율·헤드리스 실행 · 약한 모델. 이때는 "모델 추론을 신뢰하지 말라"가 정설 → 능력경계/봉쇄를 1순위로 승격.
- POKit이 외부 미신뢰 입력을 인입하게 되면(예: 외부 이슈/웹 콘텐츠 자동 수집) 해당 경로는 사다리 B로 재설계한다.

## 진짜 "벽"의 조건 (3순위로도 못 막는 것)

패턴 게이트는 쉘을 쥔 에이전트에게 결코 완벽한 벽이 아니다. 진짜 벽은 검사를 더 똑똑하게 만드는 게 아니라 **신뢰 구조를 바꿔야** 생긴다:

- **능력경계(capability boundary):** 에이전트가 그 경로에 *아예 못 씀*. 별도 신원/샌드박스가 행동을 수행(POLA).
- **외부 암호 앵커(out-of-band crypto anchor):** 에이전트가 못 가진 키로 영수증/산출물 서명, 검증자가 대조(SLSA/Sigstore류).

둘 다 신뢰 도메인이 에이전트 밖에 있어야 한다. **단일 신원·in-repo 도구(POKit)에는 셋 다 없으므로** 가드의 천장은 "마찰 + 탐지가능성"이다. 진짜 벽은 미래 옵션(사람 보유 서명 키 / 분리 신원 실행)으로만 명시하고, 지금 가드를 벽으로 주장하지 않는다.

## 외부 검증 (2026-05-30, 4-domain fan-out)

코딩 하네스 / 에이전트 프레임워크 / 가드레일·세이프티 / 에이전트 OS·능력보안 4개 도메인 독립 조사가 전부 *partially corroborates*로 수렴:

- **확증(우리 regime서):** Anthropic 2026 Claude Constitution "from guardrails to judgment"(거의 동일 문장), DSPy("가드 아니라 추론에 투자"), Claude Code 공식문서("CLAUDE.md 먼저, 훅은 못 잡는 것만"), OpenAI Agents SDK("가드레일은 게이트 아닌 트립와이어"), Aider(tier-1만 탑재).
- **shift-left:** 예방이 탐지보다 30~100× 쌈(DevSecOps).
- **③ 완벽탐지 회피:** STACK(가드 스택 71% 우회), Rice 정리 — 확증.
- **④ 진짜벽 = 능력경계/암호앵커:** Rice 정리 · POLA · SLSA/Sigstore · CaMeL — 강하게 확증.
- **반증(범위 밖):** CaMeL/Dual-LLM, Constitutional Classifiers, Zero-Trust 에이전트 — 적대적 입력 한정 봉쇄우선. POKit regime 아님.

전체 자료(도메인별 판정·증거표·출처 18종)는 v0.19 정리에서 삭제됨 — git 이력 `docs/research/benchmarks/guard-priority-ladder-validation-2026-05-30.md` (POK-339 cleanup-inventory). 설계 적용: `projects/pokit/issues/POK-204.md`.

## 의무 (가드/강제/검출 산출이 있는 카드)

가드를 추가/이동/박제하는 카드는 설계 시 다음을 자기보고한다.

```markdown
## Guard Priority Ladder Check

- 1순위(추론): <이 가드가 정답경로를 어떻게 더 쉽게/환하게 만드나, 또는 n/a>
- 2순위(예방): <행동 전 무엇을 차단하나, 또는 n/a>
- 3순위(탐지): <사후 무엇을 비추나 — tamper-evident 한도 명시>
- Regime: 사다리 A(정확성/드리프트) | 사다리 B(적대적/봉쇄) — 근거 한 줄
- 벽 주장 금지 확인: 이 가드를 보안 경계/완벽차단으로 주장하지 않음 (yes/no)
```

## 관계

- `enshrinement-policy.md`(박제 3원칙 A/B/C)의 **상위 목적함수**다. 박제 3원칙은 "어떻게 박나", 본 사다리는 "어디에 힘을 쓰나(추론>예방>탐지)"를 정한다.
- `hooks-contract.md`(hook-enforceable vs LLM-response 경계), `runtime-proof.md`(런타임 미증명 과장 금지)와 함께 가드 설계 3종 세트를 이룬다.
- 선례: 이 사다리의 하위 실천이 "가드는 길목에 둔다(옆문 금지)".
- 역할 적용: `docs/v0.14.0/orchestration-role-model.md`(POK-235)가 이 사다리를 역할에 배치한다 — `doctor_invariant_checker`는 3순위(탐지)의 tamper-evident backstop이지 벽이 아니며, `hook_permission_precheck`는 2순위(예방), 추론(1순위)은 `main_orchestrator`/`runner_contract_calculator`가 맡는다.
