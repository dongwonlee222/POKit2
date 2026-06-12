# PO-facing Simplicity Standard

POKit keeps internal rigor, but the PO-facing surface must stay simple. The PO should see what changed, what needs approval, and what to do next. The system may keep stricter labels, gates, evidence, worker routing, and doctor checks behind that surface.

Related issues: POK-129 card schema, POK-139 doctor-first behavior, POK-165 hook/runner lifecycle enforcement.

## Surface Separation

Use two surfaces:

| Surface | Audience | Purpose | Allowed content |
|---|---|---|---|
| PO-facing | PO/PM/user | decision and next action | plain Korean, concise status, approval boundary, effect-focused result, one recommended next action |
| System-facing | agent/runtime/tests | execution and verification | issue IDs, worker type, gate state, schema fields, hooks, runner output, test evidence, failure keys |

Rules:
- PO-facing text explains effects before mechanism.
- System-facing detail can exist in specs, tests, scripts, and evidence blocks.
- Do not expose worker type, fan-out, metrics, schema internals, or raw fail keys in PO-facing cards unless the PO explicitly asks.
- When a term must be shown, pair it with a plain-language label first.

## Surface Labels

Durable standards, cards, and skills must label the intended surface when the distinction matters.

Allowed labels:

| Label | Meaning |
|---|---|
| `PO-facing` | Safe to show directly to the PO as product/workflow language. |
| `System-facing` | Internal runtime, gate, doctor, test, or agent coordination detail. |
| `Dual-surface` | May appear in both, but PO-facing wording must be simpler than system evidence. |

Examples:
- Lifecycle cards are `PO-facing`.
- Gate logs and test fixtures are `System-facing`.
- Completion cards with verification rows are `Dual-surface`: result first, evidence second.

## Lifecycle Display Contract

Lifecycle cards are PO-facing decision surfaces. They must answer:

1. What state are we in?
2. What changed or is blocked?
3. What is the next action?
4. Is the next action a fact, a runner result, an LLM recommendation, or a human decision?

Minimum cards live in `.ai-os/standards/communication.md`. Runners may expand those templates with handoff, candidate, release-scope, or verification details when the expansion helps the PO decide. Expansion is allowed only when it preserves the minimum shape and does not replace approval.

Allowed expansion:
- previous work summary
- next candidate or recommended issue
- gate evidence summary
- handoff route
- one recommended next action

Not allowed:
- raw schema dumps
- multiple competing recommendation blocks
- hidden approval transitions
- replacing PO approval with card display

## Signal Source Labeling

Cards and PO-facing recommendations must show where a signal came from when the source affects trust or timing.

| Label | Source | Use when |
|---|---|---|
| `hook` | deterministic event hook | exact timing or enforcement event was captured by a hook |
| `runner` | scripted renderer/check | state was calculated, rendered, or verified by a runner |
| `LLM 판단` | model interpretation | recommendation, priority, summary, or next-action suggestion is inferred |
| `human` | PO/user decision | approval, rejection, scope choice, or product decision came from the PO |

Rules:
- Exact timing claims should be `hook` or `runner` backed.
- Recommendations must use `LLM 판단` unless they are directly encoded by runner output.
- Human approvals must be labeled as `human` when mixed with automated signals.
- Do not blur facts and recommendations in the same unlabeled line.

## Natural Language Trigger Boundary

Restart/resume phrases restore state and render the lifecycle card. Execution phrases start or continue work only inside an active approval context. The canonical trigger table lives in `.ai-os/standards/po-triggers.md`.

The important boundary:
- `시작하자` is restart/resume when there is no active execution approval context.
- The same kind of natural approval wording can be execution only when the current context is a pending/in-progress POKit issue approval flow.

## PO Summary Contract

PO-facing issue cards should place a short `PO Summary` near the top when the issue is decision-heavy or creates durable behavior.

The summary uses five lines:
- 왜 하는가
- 끝나면 뭐가 달라지는가
- PO가 확인할 것
- 위험
- 다음 행동

This aligns with POK-129. The summary is a decision aid, not a replacement for AC, gate evidence, or implementation detail.

## Doctor-First Wording

Doctor output shown to the PO should be solution-first Korean, not raw fail-key-first output.

Required order:
1. What is wrong in plain Korean.
2. Where to fix it.
3. One concrete next action.
4. Raw key only as secondary system-facing evidence when useful.

This aligns with POK-139. Raw doctor keys remain valid system-facing evidence.

## Simplicity Checklist

Before adding or changing standards, skills, lifecycle cards, or issue-card schema, answer these four questions:

| # | Question | Pass condition |
|---|---|---|
| 1 | PO가 새 단어를 외워야 하는가? | No, or the term is paired with plain Korean. |
| 2 | 카드 한 화면 안에서 다음 행동이 보이는가? | Yes, one next action is visible without reading system detail. |
| 3 | doctor 또는 runner가 drift를 자동 검출할 수 있는가? | Yes, or a deferred evidence path is explicitly stated. |
| 4 | 재개/진행/검수 흐름이 짧아졌는가? | Yes, or the added rigor is system-facing only. |

If a change fails the checklist, either simplify it, keep it system-facing, or record an explicit defer with the reason.

## Self-Dogfood

This standard passes its own checklist:

| Question | Evidence |
|---|---|
| PO가 새 단어를 외워야 하는가? | Only two surface terms are introduced, and both are defined in the first section. |
| 카드 한 화면 안에서 다음 행동이 보이는가? | Lifecycle and PO Summary sections require one visible next action. |
| doctor 또는 runner가 drift를 자동 검출할 수 있는가? | POK-139 and POK-165 references define doctor/runner enforcement paths. |
| 재개/진행/검수 흐름이 짧아졌는가? | Trigger boundary delegates natural wording to `po-triggers.md`, reducing command memorization. |

## References

- POK-129: issue-card schema and PO Summary integration.
- POK-139: doctor-first, solution-oriented feedback.
- POK-165: hook/runner enforcement matrix for lifecycle rendering.
- POK-150: this standard's source issue.
