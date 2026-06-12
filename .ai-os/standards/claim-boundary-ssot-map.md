# Claim-Boundary SSoT Map

POKit standards repeat runtime-proof and authorization-boundary language across many
files. The repetition helped during hardening but now creates drift and
"which document is the SSoT?" confusion (POK-284 / `docs/v0.16.0/reliability-inventory.md`
rows recommending "move the claim boundary to an SSoT").

This file is the single source of truth for **who owns each claim-boundary rule**.
It does not restate the full rules; it points to the owning standard. When wording
needs to change, change it in the owner, then update the references listed here.

## Ownership Table

| Claim-boundary rule | Owner (SSoT) | Canonical location |
|---|---|---|
| A gate claim requires fresh verification; subagent output alone is not completion proof | `completion-claim.md` | `## Rule` |
| Worker / subagent output is input evidence, not completion proof; subagents cannot claim done | `agent-invocation.md` | top rules + `### Codex Subagent Authorization Bridge` |
| Authorization (execution-approval synonyms) is not execution proof; authorization scope is the active issue only | `agent-invocation.md` | `### Codex Subagent Authorization Bridge` (`authorized_phrases` is the synonym SSoT) |
| Runtime support claims (`discovery` / `trigger` / `execution`); structural existence or authorization is not runtime execution proof; one provider's proof never transfers | `runtime-proof.md` | `## Proof Levels` |
| Cross-session / worktree output is input evidence, not completion proof; integrator owns merge + fresh verification | `execution-lanes.md` | `## Cross-Session Merge Contract` + `### Main-Only Integration Surface` |

## Reference Rule

A standard, skill, doc, or command template that needs a claim-boundary rule it does
**not** own should point to the owner via this map instead of re-deriving the rule.
Use a short reference such as `claim-boundary SSoT: <owner> — see claim-boundary-ssot-map.md`.
Keep the concrete, testable rule in the owning standard.

This map must not weaken any boundary: authorization stays separate from execution
proof, and worker/subagent output stays input evidence rather than completion proof.

## Kept-Duplicate Rationale (runtime entrypoints)

Some surfaces keep their own claim-boundary wording on purpose because a runtime reads
or triggers them directly and the local guard must stay visible at the point of use.
These are intentionally not reduced to a bare reference:

| Surface | Why local wording stays |
|---|---|
| `.claude/skills/pokit-issue/SKILL.md` | Execution-contract entrypoint; `authorization`, `Workers: none` + `Fallback reason`, and Worker-Task-as-planning-evidence guards must be readable inline where `/pokit.issue` runs. |
| `.claude/skills/pokit-next/SKILL.md` | Transition entrypoint; authorization and worker-evidence guard read at routing time. |
| `.ai-os/templates/commands/issue.md`, `.claude/commands/pokit.issue.md` | Command surfaces a runtime renders; the "authorization is not execution proof" guard must travel with the seed. Drift across these copies is covered by the doctor/token-drift checks, not by deleting the guard. |
| `docs/v0.16.0/reliability-inventory.md`, `docs/v0.16.0/runtime-capability-matrix.md` | Analysis/inventory docs that quote the boundary as findings; quoting is the point. |

## Preserved Contract Tokens

The compaction keeps these public command/skill contract tokens present and testable:
`pokit.issue`, `pokit.backlog`, `pokit.next`, `gate evidence`, `authorization`,
`execution proof`.

## References

- `completion-claim.md` — gate evidence / completion-proof boundary owner
- `agent-invocation.md` — worker-output and authorization boundary owner
- `runtime-proof.md` — runtime support claim-level owner
- `execution-lanes.md` — cross-session integration boundary owner
- `docs/v0.16.0/reliability-inventory.md` — POK-284 findings that requested this SSoT
- POK-295 — issue that created this map
