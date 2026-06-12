# Completion Claim Standard

A completion claim is valid only when backed by fresh verification evidence recorded in the POK Gate section. Roadmap §19 #19 and FRG-001 open question resolved.

## Rule

**A gate claim requires fresh verification. Subagent output alone is not completion proof.**

This standard is the SSoT for the gate-evidence / completion-proof boundary; the full claim-boundary ownership map is in `claim-boundary-ssot-map.md`.

Record at minimum:
1. `command` — exact shell command or tool invocation run
2. `exit_code` — 0 for success, non-zero for failure (or equivalent: "pass", "N/N pass")
3. `evidence_paths` — files changed or verified (git diff --stat output or explicit list)
4. `verification_timestamp` — date of fresh run (YYYY-MM-DD)

If any of these four are absent, the gate claim is incomplete.

## Scope-reduction follow-up capture (POK-306)

Before a gate claim, if the issue **intentionally** reduced scope — work moved out-of-scope, deferred, split to later, or treated as follow-up — every dropped item must have a durable, file-persisted record: a follow-up candidate issue card / POK-ID, a `release-scope.yaml` / backlog entry, or a `deferred-with-reason` line in the issue card or release-scope. Chat-only or free-text-in-conversation does not count. `deferred-with-reason` requires no PO approval; minting a durable candidate card does (it routes through `/pokit.backlog`).

This applies only to explicit scope-reduction decisions, not routine wording. The `/pokit.issue` Post-change Review Gate carries the self-attested check; `/pokit.clarify` (its `## Clarifications` table) and `/pokit.backlog` inherit the intent through their existing durable records. Detection automation (warning when follow-up/later work is mentioned without candidate/deferred evidence) is intentionally deferred — see POK-306 `## Deferred (with reason)`.

## POK Gate Section Standard

Use this structure for all Gate sections:

```markdown
## Gate

gate_passed YYYY-MM-DD. [One sentence: what was done.]
[One sentence: key decision or scope boundary.]

- tests     node --test tests/*.mjs → N/N pass
- doctor    node scripts/pokit-doctor.mjs → pass (fail=0)
- diff      git diff --check → clean
- changed   [file paths changed or "no file changes"]
```

Compressed single-line form (for narrow-scope issues):

```markdown
## Gate

gate_passed YYYY-MM-DD. [Work summary]. Full suite N/N pass. [Any notable verification result].
```

Both forms are valid. The requirement is that command + result pairs are present and a reader could reproduce the verification.

## Anti-patterns

The following Gate section forms are not valid completion evidence:

| Anti-pattern | Why invalid |
|---|---|
| `Gate passed.` only | No evidence at all |
| `Subagent review: PASS` | Subagent output ≠ fresh verification |
| `Test command output: ... reports 22 pass` | Implied command, no actual command string |
| `Evidence: [no-prior-failure] exists` | Structural check description, not fresh run |
| `Changed artifact paths` (header only, no content) | Missing paths |
| `Hash proof: abc123...` (no verification command) | Hash origin unknown, not reproducible |
| `파일 생성됨` (작동 검증 없음) | 파일 존재는 필요조건일 뿐 충분조건이 아님. 런타임이 실제로 파일을 로드·인식했다는 증거가 별도 필요 |

## runtime_proof Evidence

For issues that create runtime integration features (skills, hooks, runner commands), the Gate section must include `runtime_proof` in addition to the standard four fields:

```
- runtime_proof  <how the runtime was verified to recognize/execute this feature>
```

Valid Claude example:
```
- runtime_proof  Fresh Claude Code session opened → pokit-issue appeared in system-reminder skills list ✅
```

Valid Codex example:
```
- runtime_proof  Fresh codex exec/app session opened → pokit-issue appeared in available skills and trigger fired ✅
```

Invalid:
```
- runtime_proof  TRIGGER section present in skill file  ← structural check only, not runtime proof
- runtime_proof  node scripts/pokit-doctor.mjs reports internal_skill pass  ← structural check only, not runtime proof
```

Same-session observation does not count — the current agent may already hold the file in context.

## Lifecycle Card ✅ Complete Evidence Fields

The `검수` row in the ✅ Complete lifecycle card must include at minimum:

```text
│ 검수
│   tests   node --test tests/*.mjs → N/N pass
│   doctor  node scripts/pokit-doctor.mjs → pass
│   diff    git diff --check → clean
```

Optional rows when relevant:
```text
│   changed   [key file paths]
│   jsonl     .ai-os/events/event-log.jsonl → parsed OK
```

## Relation to FRG-001

FRG-001 requires:
- Run the relevant verification command fresh.
- Record command, exit code, and result.
- Do not use subagent output alone as completion evidence.

This standard operationalizes FRG-001 by defining where (Gate section + lifecycle card `검수`) and what format (command + exit_code + evidence_paths + verification_timestamp) to record evidence.

## Existing Gate Evidence Audit

Audit performed as part of POK-069. Gate sections with insufficient evidence (no commands or no exit codes):

- POK-001 through ~POK-010: descriptive only, no shell commands recorded.
- POK-005: structured headers present but values absent.

These are not retroactively fixed in POK-069. A dedicated cleanup issue will address them when the policy requires backward cleanup.

## Scope Boundary

- This standard governs the Gate section and lifecycle card `검수` row.
- `session-summary.md` Verification section follows the same command + result pair pattern.
- `gate-result.md` as a separate artifact is out of scope (deferred to v0.4+).
- Retroactive Gate section cleanup is out of scope (separate cleanup issue).
