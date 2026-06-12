# Reasoning-First Harness Standard

## Purpose

POKit harness design prioritizes agent reasoning before hooks or doctor checks.

The harness should make the correct action the easiest action. Hooks and doctor checks are backstops for drift, not the primary product experience.

## Harness Order

```text
1. Reasoning optimization
   Make the correct path obvious, low-friction, and timely.

2. Hook pre-check
   Catch wrong actions before they mutate state when the behavior is hook-enforceable.

3. Doctor post-check
   Detect remaining drift before gate claims and make mistakes visible.
```

This order is an operating rule for accuracy and productivity. It is not a security boundary.

## Role Placement in the Order (POK-235)

The v0.14 orchestration role model (`docs/v0.14.0/orchestration-role-model.md`) places each role on this same reasoning/prevention/detection ladder, plus a learning layer for agent-judgment quality:

| Order | Stage | Role(s) | Responsibility on the ladder |
|---|---|---|---|
| 1 | Reasoning | `main_orchestrator`, `runner_contract_calculator` | Main reasons and decides; the runner makes the correct path obvious by computing the workflow contract (classification, route, approval boundary, worker recommendation, verification intensity, receipt/checkpoint contract). The runner is a calculator, not an executor — it never mutates state. |
| 2 | Prevention | `hook_permission_precheck` | Block must-not side effects (destructive/global/external write) before they mutate state, only where the behavior is hook-enforceable. |
| 3 | Detection | `doctor_invariant_checker` | Detect remaining drift and missing evidence before gate claims. Tamper-evident backstop, not a security wall and not PO judgment. |
| 4 | Learning | `eval_judgment_checker` | Sample whether the agent made the right workflow decisions; feed repeated judgment failures into retro/eval seeds. Kept separate from doctor. |

Anti-confusion rules for these roles (runner-as-executor, worker-output-as-completion-proof, doctor-as-PO-judgment/security-wall) live in the role model doc and the `agent-evals.md` seed scenarios.

## Seven Reasoning Levers

Use these levers before adding a hook or doctor check.

| # | Lever | Design question |
|---|---|---|
| 1 | Make the right path easier | Is the correct path less work than the wrong path? |
| 2 | Put rules on the path | Does the agent see the rule exactly when it must decide? |
| 3 | Teach when blocking | If blocked, does the message explain the next correct action? |
| 4 | Shape thought with blanks | Does a template/checklist force the missing decision into view? |
| 5 | Name and reuse precedents | Is the principle named so future work can cite it? |
| 6 | Ask before ambiguity | Does the flow close assumptions before durable mutation? |
| 7 | State what not to do | Are forbidden shortcuts explicit? |

## Required Design Check

Any issue that changes skill routing, hooks, doctor checks, agent workflow, or gate evidence must include:

```markdown
## Reasoning-First Harness Check

- 1. Easier path:
- 2. Rule on path:
- 3. Blocking teaches:
- 4. Thought blanks:
- 5. Named precedent:
- 6. Ambiguity first:
- 7. Forbidden shortcuts:
- Hook pre-check:
- Doctor post-check:
```

Use `n/a` only when the issue does not affect agent routing, workflow, hook behavior, doctor behavior, or gate evidence.

## POKit Skill Routing Application

POK-208 establishes the two-skill routing rule:

```text
Issue creation / issue modification / grooming / definition changes -> pokit.backlog
Ready issue execution / gate workflow -> pokit.issue
```

This rule must be visible in the decision path, not only in archived issue history.

POK-236 and POK-223 add a project-level tier above the
two issue-level skills, applying Lever 1 (make the right path easier): when the
project changes, the user opens a new chat, and that chat naturally owns one
project-scoped session.

```text
Project create / switch / list                       -> pokit.project   (POK-223 bootstrap)
Issue creation / modification / grooming / definition -> pokit.backlog
Ready issue execution / gate workflow                -> pokit.issue
```

The desired failure mode is:

1. The agent naturally chooses the right skill from context.
2. If it chooses wrong, the hook or runner redirects before mutation when feasible.
3. If mutation happened anyway, doctor exposes the drift before gate.

## Relationship

- `.ai-os/standards/guard-priority-ladder.md` defines the higher-level order: reasoning > prevention > detection.
- This standard is the operational checklist for applying that order to POKit skills, hooks, doctor checks, and workflow surfaces.
