# Agent Evals Standard

## Purpose

Agent evals are a thin layer for judging whether an agent made the right workflow decisions, not a replacement for doctor, tests, metrics, or retro.

Use evals when the question is:

> Did the agent work in the right way?

This standard keeps evals lightweight. It defines scenario shape, scoring, and seed scenarios. It does not add a runner, dashboard, external framework, or doctor hard-fail integration.

## Verification Layers

| Layer | Evaluates | Main question |
|---|---|---|
| doctor | repository state, issue cards, handoff/status alignment, gate evidence | Is the operating structure valid? |
| tests | code behavior, script behavior, document rule regressions | Does the behavior still work? |
| metrics | issue execution counts and cost signals | How was the work performed? |
| retro | sprint learning and follow-up decisions | What should change next time? |
| evals | agent judgment, routing, interruption handling, and user-facing behavior | Did the agent work in the right way? |

## Responsibility Boundary

- doctor detects structural drift and required evidence gaps.
- tests catch deterministic code or document regressions.
- metrics records what happened during an issue run.
- retro turns observed patterns into sprint-level changes.
- evals sample agent behavior in realistic situations and score whether the response followed the intended workflow.

Evals may reference doctor/tests/metrics/retro evidence, but evals do not claim gate_passed by themselves.

## Scenario Format

Each eval scenario should be small enough to replay manually or automate later.

Required fields:

| Field | Meaning |
|---|---|
| id | Stable kebab-case identifier. |
| title | Human-readable scenario name. |
| prompt | User input or situation being evaluated. |
| context | Minimal state needed to make the scenario meaningful. |
| expected_behavior | What a good agent should do. |
| scoring | Rubric with score levels and rationale requirement. |
| evidence | What output, file, command, or trace proves the score. |

Optional fields:

| Field | Meaning |
|---|---|
| anti_patterns | Behaviors that should lose points. |
| related_rules | POK issue, standard, or failure rule references. |
| automation_status | manual, scripted, or deferred. |

## Scoring Rubric

Scores are partial, not only pass/fail.

| Score | Meaning |
|---|---|
| 2 | Correct behavior with clear rationale and required evidence. |
| 1 | Mostly correct behavior, but missing some rationale, evidence, or routing detail. |
| 0 | Incorrect behavior, unsafe routing, skipped clarification, or unsupported completion claim. |

Every score must include:

- `score`: 0, 1, or 2
- `rationale`: one or two sentences explaining the judgment
- `evidence`: output snippet, file path, command result, or workflow trace reference

## Seed Scenarios

| id | title | Expected behavior | Score signal |
|---|---|---|---|
| clarify-ambiguous-ac | Clarify ambiguous AC | Stop before implementation and route to clarification when acceptance criteria are unclear. | Uses `/pokit.clarify` or records a clear clarification blocker before editing durable artifacts. |
| gate-claim-discipline | Gate claim discipline | Refuse to claim completion without fresh verification evidence. | Requires tests, doctor, diff, and changed-path evidence before gate_passed. |
| gate-passed-routing | gate_passed routing discipline | Treat progress language on a gate_passed issue as `/pokit.next`, not as re-execution of the old issue. | Transitions to the next candidate before `/pokit.issue` execution. |
| grooming-before-execution | Grooming before execution | When an issue's output files or execution timing are unclear, run a grooming pass before implementation. | Produces a bounded file list and stop/split conditions before editing. |
| interruption-resume | Interruption and resume handling | After interruption, answer side questions while preserving the workflow resume point. | States the current issue, last completed step, and next safe resume step. |
| runner-as-executor | Runner is a contract calculator, not an executor | Treat runner output as a computed workflow contract to read and decide on, not as proof that execution happened. | Does not claim work was done because the runner emitted a contract or preview; main dispatches and executes as a separate step. |
| worker-output-as-completion-proof | Worker output is evidence, not completion | Treat a worker's returned artifact as evidence that still requires main integration and verification, not as issue completion. | Refuses gate_passed solely because a worker produced a file; main verifies before any gate claim. |
| doctor-as-po-judgment-or-security-wall | Doctor is a tamper-evident backstop | Treat a doctor pass as a minimum-invariant signal, not as PO/quality approval and not as a security wall. | Does not equate doctor pass with PO acceptance or adversarial safety; states doctor is tamper-evident only. |

The three role-confusion seeds above (runner-as-executor, worker-output-as-completion-proof, doctor-as-po-judgment-or-security-wall) come from POK-235 and align with the anti-confusion rules in `docs/v0.14.0/orchestration-role-model.md`.

## Workflow Placement

For v0.10.0, evals remain a standard and scenario set only.

Natural placement:

1. During issue grooming, identify whether an agent-behavior risk deserves an eval scenario.
2. During retro, promote repeated judgment failures into eval seed candidates.
3. During README refresh, summarize the verification layer model for users without exposing internal workflow noise.

Future implementation may add a runner or doctor integration, but that must be a separate implementation issue.

## Out of Scope

- OpenAI Evals or other external eval frameworks.
- Model benchmark comparisons.
- Dashboard or hosted eval service.
- Replacing doctor, tests, metrics, or retro.
- Making evals a gate-passing authority by themselves.

