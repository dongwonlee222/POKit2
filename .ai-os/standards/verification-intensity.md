# Verification Intensity Standard

## Purpose

Verification intensity defines how much evidence POKit should require at each workflow boundary.

The goal is not to run every check on every turn. The goal is to leave enough fresh evidence for the PO to trust the next step without creating operational fatigue.

## Intensity Levels

| Level | Use when | Required checks | Optional checks | Forbidden by default |
|---|---|---|---|---|
| `startup_or_transition` | Session start, resume, or issue transition before durable work. | Runner state read, active issue/gate summary, next route calculation. | Candidate decision gate scan when startup rules require it. | Full doctor dump, broad tests, broad evals, metrics generation, sprint retro. |
| `docs_only_change` | Only standards, issue text, docs, or public-facing copy changed. | Changed-path review, acceptance criteria mapping, `git diff --check`. | Focused doc/schema test if one already exists for the touched artifact. | Full test suite, full doctor log dump, broad evals, metrics generation. |
| `code_change` | Runtime scripts, tests, fixtures, generated behavior, or executable contracts changed. | Focused tests for changed behavior, `git diff --check`, changed-path review. | Full tests when shared behavior, runner routing, doctor guards, or release surface changed. Doctor summary when gate evidence is being prepared. | Broad evals, sprint retro, full doctor log dump unless investigating failure. |
| `gate_claim` | Agent claims an issue is complete, gate-passed, or ready for PO decision. | Fresh gate evidence: relevant tests or doc checks, doctor summary, `git diff --check`, changed-path list, AC coverage. | Full tests when code path blast radius is broad. Focused evals when the risk is agent behavior or routing judgment. | Claiming completion from stale evidence, raw full doctor log dump in PO-facing output, broad evals with no specific risk. |
| `sprint_close` | Sprint close, release readiness, or retrospective boundary. | Sprint-close command or equivalent close checklist, doctor summary, relevant tests, diff check, retro or handoff evidence. | Metrics summary, focused eval sample for repeated agent-behavior risks. | Skipping manual PO decision points, replacing close evidence with narrative confidence, raw full logs in PO-facing summary. |

## Compact PO-Facing Evidence

PO-facing verification output should be compact by default:

- Show command or check name.
- Show result as `pass`, `fail`, `warning`, or `not_applicable`.
- Include counts when useful.
- Include only the first actionable failure or warning line unless the PO asks for full detail.
- Link or name the artifact that contains full evidence when such an artifact exists.

Do not paste full doctor output, full test logs, broad eval transcripts, or large metrics payloads into normal PO-facing responses unless the task is specifically to inspect those logs.

## Responsibility Boundary

| Surface | Responsibility | Not responsible for |
|---|---|---|
| runner | Calculate route, approval boundary, and `verification_intensity` from command, phase, current gate state, and active issue metadata. | Executing every check, making PO decisions, dumping full logs. |
| skills | Consume runner output and perform the workflow using the required intensity. Escalate optional checks when risk or changed paths justify them. | Inventing a weaker intensity than runner required, bypassing PO approval, claiming gates without evidence. |
| doctor | Enforce minimum structural invariants and gate-claim evidence gaps. | Acting as the central router, encoding every workflow nuance, judging PO intent, producing long self-evaluations. |
| tests | Prove deterministic code, runner, doctor, schema, and document-rule behavior. | Replacing PO acceptance or retro judgment. |
| evals | Sample agent behavior, routing judgment, and user-facing discipline. | Becoming a required check for every turn or a gate-passing authority by itself. |

## `verification_intensity` Payload Schema

Runner output may include this object:

```yaml
verification_intensity:
  level: startup_or_transition | docs_only_change | code_change | gate_claim | sprint_close
  reason: short public-safe explanation of why this level was selected
  required_checks:
    - id: stable_check_id
      label: short PO-facing label
      evidence: compact_evidence | command_summary | changed_path_review | ac_coverage
  optional_checks:
    - id: stable_check_id
      trigger: when this check should be promoted to required
  forbidden_by_default:
    - id: stable_check_id
      unless: condition that makes the check justified
  po_evidence_mode: compact
  stale_evidence_policy: fresh_required | reusable_if_unchanged | not_applicable
  consumer: pokit-issue | pokit-next | runner | manual
```

Field rules:

| Field | Required | Meaning |
|---|---:|---|
| `level` | yes | One of the five intensity levels in this standard. |
| `reason` | yes | One concise explanation suitable for PO-facing summaries. |
| `required_checks` | yes | Checks that must be satisfied before the workflow may claim completion for that boundary. |
| `optional_checks` | yes | Checks the skill may promote when changed paths, failures, or risk justify them. Use an empty list when none apply. |
| `forbidden_by_default` | yes | Expensive or noisy checks that should not run unless the listed condition is met. |
| `po_evidence_mode` | yes | Defaults to `compact`; full logs require an explicit investigation or PO request. |
| `stale_evidence_policy` | yes | Whether previous evidence can be reused. Gate claims use `fresh_required`. |
| `consumer` | yes | The primary workflow surface expected to consume the payload. |

## Consumption Rules

### `pokit-issue`

`pokit-issue` treats `verification_intensity` as the minimum verification contract for the current issue run.

- For `docs_only_change`, it should require AC coverage, changed-path review, and diff check. It may skip full tests and full doctor unless a focused doc guard or gate claim requires them.
- For `code_change`, it should run focused tests for the touched behavior and promote to full tests when shared runtime behavior changes.
- For `gate_claim`, it must collect fresh compact evidence before reporting done or gate-ready.
- It must not downgrade runner-required checks based only on convenience or token cost.

### `pokit-next`

`pokit-next` consumes `verification_intensity` at transition boundaries.

- From `gate_passed` to the next active issue, it should use `startup_or_transition` unless it is also making a gate or sprint-close claim.
- It should preserve lightweight transition behavior: route, issue choice, and next-action evidence first.
- It must not run full doctor, full tests, or broad evals by default during simple next-issue selection.
- If transition reveals unresolved candidate decision gates or sprint-close conditions, it may promote the level to `sprint_close` or require PO confirmation before mutation.

## Defaults

- Compact evidence is the default PO-facing mode.
- Fresh evidence is required for `gate_claim` and `sprint_close`.
- Startup and transition stay lightweight unless a rule explicitly promotes the level.
- Doctor protects gate invariants; it does not own workflow strategy.
- Evals stay targeted to agent-behavior risk and are not a universal gate.

## Public-Safe Constraint

This standard must avoid local absolute paths, private credentials, user-specific machine details, raw logs containing sensitive data, and repo-external storage assumptions.
