# Execution Lane Recommendation Standard

POK-303 standardizes how POKit recommends where work should run before a user
or runner starts durable execution.

## Purpose

Execution lane recommendation answers a different question than sprint routing.

- Sprint routing decides when work belongs in the roadmap.
- Execution lane recommendation decides where the next piece of work should run.

The recommendation is advisory until execution leaves evidence. A lane hint must
not claim that a subagent, separate thread, or worktree actually ran.

## Lane Vocabulary

| Lane | Use when | Avoid when |
|---|---|---|
| `main_session` | Work owns active state, gate evidence, integration, global standards, or narrow issue-card edits. | The work is a long experiment or can be safely isolated. |
| `subagent` | A bounded read, review, research, or implementation task belongs to the same active issue and can return a compact result to the main session. | The runtime has no callable subagent proof, the user has not authorized subagent use under that runtime contract, or the task needs independent gate ownership. |
| `separate_thread` | Independent research/spec work can proceed without touching the active issue's writable files, and preserving a separate conversation context is useful. | The work must update current state, gate evidence, or the same files as the active issue. |
| `worktree` | A code experiment, refactor, or risky implementation benefits from isolated git state, easy discardability, branch/PR review, or reduced file conflict. | The repo or runtime cannot provide worktree evidence, or the task is only a small docs/state edit. |
| `backlog_refinement` | The candidate is not ready: AC, archive path, threshold, dependencies, conflict scope, or lane fit is unclear. | The issue is already accepted with a passable ready gate. |
| `defer` | The candidate is blocked, not sprint-fit, lower priority, or depends on a later integration decision. | The work is approved and unblocked in the current sprint. |

## Decision Inputs

Use these inputs before recommending a lane:

| Input | Source | Why it matters |
|---|---|---|
| `depends_on` | issue card | Unmet dependencies usually push the item to `backlog_refinement` or `defer`. |
| `definition_readiness` | issue card | `draft` usually means refine first; `pass` can enter next selection or execution. |
| `issue_type` / `work_type` | issue card | Specs often fit `main_session` or `separate_thread`; broad implementation/refactor often fits `worktree`. |
| `conflict_scope` | issue card | Shared writable files with the active issue favor `main_session`; low overlap favors `separate_thread` or `worktree`. |
| active issue file overlap | current issue + candidate cards | Prevents two lanes from editing the same state, standards, or tests without coordination. |
| runtime capability | capability matrix, runner receipts, tool availability | Prevents unsupported claims about subagents, threads, or worktrees. |
| discardability | PO intent + work type | High-discard experiments favor `worktree`; durable policy integration favors `main_session`. |
| duration/noise | issue size + expected verification | Long exploration favors isolation; short gate work can stay in main. |
| gate/state ownership | `.ai-os/current.md`, issue trace | Only the main session owns final state, metrics, gate evidence, and PO approval handoff. |

## Responsibility Split

| Surface | Responsibility | Must not do |
|---|---|---|
| Backlog refinement | Author stable issue-level hints: readiness, dependencies, conflict scope, possible lane fit, and unresolved questions. | Claim execution occurred or create threads/worktrees. |
| Sprint scope | Compare candidates as a batch: priority, dependency order, file conflicts, parallel-safe candidates, and candidates that should remain refinement-only. | Treat display-only lane hints as gate evidence. |
| `/pokit.next` | Present the next issue recommendation and, when useful, a lane recommendation with reason, avoid note, and next owner. | Mutate issue state beyond the next-selection contract or start a separate lane by itself. |
| `/pokit.issue` | Execute the active issue, record the actual worker/thread/worktree evidence or fallback, create metrics, verify, commit, and request gate approval. | Claim a lane executed without evidence. |

## Cross-Session Merge Contract

POK-304 extends the lane vocabulary after `separate_thread` or `worktree`
work produces durable output outside the main session.

| Surface | Owner | Allowed output | Must not do |
|---|---|---|---|
| Spawned thread/session | Worker session | Research notes, proposed spec text, commits, branch/worktree evidence, verification notes. | Update global state, claim gate completion, merge into main, push as final integration, or rewrite main-only surfaces. |
| Worktree branch | Worker session | Isolated file changes and commits inside its branch/worktree. | Treat branch existence as completion proof, edit main-only global files, or delete the worktree before deciding merge/push/keep. |
| Main session / integrator | Main session | Diff review, merge decision, conflict resolution, verification, global state updates, metrics, commit, and gate claim. | Claim spawned output as complete without inspection and fresh verification. |

Cross-session output is input evidence, not completion proof. The integrator
must inspect the diff, verify relevant checks, and update gate/state surfaces
only after accepting the result. This standard is the SSoT for the cross-session
integration boundary; the full claim-boundary ownership map is in
`claim-boundary-ssot-map.md`.

### Main-Only Integration Surface

Spawned sessions must not edit these surfaces directly:

- `.ai-os/current.md`
- `.ai-os/status-board.md`
- `.ai-os/issue-index.md`
- `.ai-os/memory/session/handoff.md`
- `.ai-os/memory-index.md`
- `.ai-os/failure-index.md`
- `.ai-os/sprints/*/release-scope.yaml`
- issue card frontmatter fields that change lifecycle or gate state
- `.ai-os/runs/*/metrics.json`
- final integration commits, pushes, and gate-pass claims

If a spawned session needs one of these surfaces changed, it emits a proposed
update or handoff note. The main session integrates it.

### Pre-Merge Checklist

Before merging or accepting a cross-session result, the integrator checks:

1. The worktree or branch identity is runtime-specific and recorded accurately.
2. The diff stays inside the assigned work scope.
3. No main-only integration surface was edited by the spawned session.
4. Verification evidence exists and is rerun or accepted by the integrator.
5. Any merge conflict is resolved by the integrator, not hidden in the worker output.
6. Gate evidence and metrics are written only after the accepted merge or intake.

### Cleanup Order

Cleanup order is:

```text
inspect status -> commit or discard -> merge/push/keep decision -> remove worktree/session
```

Deleting a worktree or closing a spawned session before the merge/push/keep
decision risks losing uncommitted or unmerged work. A future implementation may
add doctor or checklist detection for worktree branches that touched main-only
surfaces, but automatic merge tooling is out of scope for this standard.

## Decision Order

1. If readiness is `draft` or key dependencies are unresolved, recommend
   `backlog_refinement` or `defer`.
2. If the work owns active state, gate files, current sprint metadata, or global
   integration, recommend `main_session`.
3. If the work is a bounded task inside the active issue and the runtime has
   callable subagent proof, recommend `subagent`; otherwise execute in main and
   record `worker-unavailable`.
4. If the work is independent research/spec with low writable overlap, recommend
   `separate_thread`.
5. If the work is code-heavy, experimental, high-churn, or branch/PR-friendly,
   recommend `worktree`.
6. If the work is lower priority, blocked, or not sprint-fit, recommend `defer`.

## Display Shape

PO-facing cards can use this compact shape:

```yaml
lane_recommendation:
  lane: worktree
  reason: "High-churn runner/doctor refactor with branch-friendly verification."
  avoid: "Do not edit active gate/current state from the worker lane."
  next_owner: pokit.issue
```

`next_owner` values are advisory:

- `pokit.backlog`: refine readiness, AC, dependencies, or conflict scope.
- `pokit.next`: choose among accepted/gate-passed candidates.
- `pokit.issue`: execute the active issue in the main session and record evidence.
- `thread`: user-visible separate thread handoff is appropriate.
- `worktree`: isolated git worktree/branch is appropriate.

## Candidate Examples

| Candidate | Recommended lane | Reason |
|---|---|---|
| POK-303 | `main_session` | The work defines this standard, updates issue/state surfaces, and owns gate evidence. |
| POK-293 | `worktree` | Runner/doctor modularization is code-heavy, high-churn, and branch-friendly. |
| POK-302 | `separate_thread` then `main_session` integration | Archive policy research can be isolated, but final state/standard updates should be integrated in main. |
| POK-265 | `backlog_refinement` first | `research_worker` semantics and runtime capability proof are still draft and should be clarified before execution. |
| POK-295 | `main_session` or `separate_thread` | Standards compaction may be narrow enough for main; if auditing repeated prose across many docs, isolate the read/research pass. |

## Runtime Claim Boundary

Lane recommendation is not execution evidence.

To claim a lane actually ran, the issue trace or metrics must include concrete
evidence:

- `subagent`: worker identifier, allowed paths, result summary, and metrics.
- `separate_thread`: thread id/link or explicit user-created thread receipt.
- `worktree`: worktree path/branch and git evidence.
- fallback: explicit fallback reason such as `worker-unavailable`.

For cross-session worktree output, the required evidence is not just the
worktree path. It also includes the integrator's merge/intake decision,
pre-merge checklist result, and fresh verification before any gate claim.

If capability discovery and user authorization diverge, the trace must describe
the stricter runtime boundary and proceed in `main_session` unless the user
explicitly authorizes the required surface.

## Follow-Up Boundary

POK-303 defines the standard only. Future implementation issues may:

- add lane hints to `/pokit.next` cards;
- add optional display-only lane fields to `release-scope.yaml`;
- add doctor warnings for oversized or conflicting lane hints;
- wire worktree/thread handoff receipts into execution metrics.
