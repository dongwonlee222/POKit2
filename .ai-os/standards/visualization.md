# Visualization Standard

- Use ASCII for state, flow, and before/after comparisons.
- Use Mermaid only when relationships are too complex for ASCII.
- Every visualization must clarify a decision, state, gate, or dependency.
- Do not add decorative diagrams.

## User-Facing Card Style (POK-237)

User surfaces show the core first and fold internal machinery. The goal is "한눈에": a new user understands POKit2 at a glance and can use it by talking.

Concept explainer cards follow a two-card shape:

```text
① 무엇인가 — 정체성 한 줄 + 핵심 루프 + 접힌 기계
   요청 ─▸ 이슈 ─▸ 검증 ─▸ 게이트 ─▸ 다음
② 어떻게 쓰나 — "말만 하면 됨" (포킷 시작 / 만들고 싶어 / 진행하자 / 다음)
```

- Lead with one identity line: "POKit2 = 이슈 드리븐 하네스".
- Show the core loop; keep workers / verification layers / runner as a folded "더 알고 싶으면" layer, not on the first surface.
- Separate 검증(증거 모으기) from 게이트(그 증거로 통과 판정) when both appear.

## Plain-Language Output Rule (POK-237)

Internal English field/event names stay in files, logs, and structured output. User-facing surfaces must not show raw internal tokens. Enforcement is the render-stage filter `plainifyUserText` (`scripts/lib/user-text.mjs`), wired at the runner startup-card build chokepoint (`pokit-runner.mjs` `buildStartupLifecycleCardFields`) — the surface where the leak was observed. PO-facing skill responses follow the same rule by convention; `findForbiddenUserTokens` is the regression guard (filter coverage is kept a superset of the detector so anything flagged is also cleaned).

| Internal token (forbidden on user surface) | User-facing text |
|---|---|
| `gate_state: gate_passed` | 완료(게이트 통과) |
| `gate_state: pending` / `in_progress` | 진행 중 |
| `candidates 잔여 N` | 남은 후보 N |
| `npm test N/N` | 테스트 통과 |
| `doctor fail 0` | 자동 점검 통과 |
| `fan-out` | 작업 나눔 |
| `receipt` / `영수증` | 기록 |

- Verification has seven internal layers (doctor, tests, evals, receipts/기록, metrics, retro, QA); fold them to a single user-facing line (e.g., "자동 점검 통과"). Keep the detail in files / structured output.
- Issue IDs (`POK-XXX`) are proper nouns and are kept verbatim — never plainified.
- POKit's own development issues may still expose POK ID, gate, doctor, Workflow Trace, metrics, and Worker Tasks evidence in system-facing output; the rule above governs the PO-facing card surface.
