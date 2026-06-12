# Hooks Contract v0.1

이게 v0.1 contract. 다음 hook 추가 시 이 문서를 확장한다.

이 문서는 POK-128에서 `after_gate_pass` hook이 실제 동작한 뒤 emit된 모양을 그대로 박제한 것이다. POKit 원칙: **"contract는 hook이 살아 움직인 뒤 추출한다."** — 사용되지 않는 event를 미리 정의하지 않는다.

## Scope

- 1 event: `after_gate_pass`
- 6 manifest 필드
- 7 payload 필드

13 event / 28 payload 큰 그림은 [docs/research/benchmarks/v2-external-systems.md Appendix A](../../docs/research/benchmarks/v2-external-systems.md)에 reference로 보관. contract가 아닌 사전 조사 산물이다.

## Event Catalog

현재 contract에 들어온 event는 1개뿐이다.

| Event | Trigger | Provider 의존 |
|---|---|---|
| `after_gate_pass` | `pokit-runner gate-pass POK-XXX` 또는 `git post-commit`에서 `POK-XXX ... gate_passed` 커밋 감지 시 | 없음 (runner/lib + git hook wrapper) |

## MVP Natural Hook Matrix (POK-130)

v0.11 MVP hook contract는 `after_gate_pass`만 active event로 둔다. 나머지는 후보로만 기록하고 payload/adapter 구현을 만들지 않는다.

| Hook | MVP state | Natural trigger | Core output | Adapter expectation |
|---|---|---|---|---|
| `after_gate_pass` | active | `pokit-runner gate-pass POK-XXX` 또는 `git post-commit`이 `POK-XXX ... gate_passed` 커밋을 감지 | stdout payload 또는 `.ai-os/events/event-log.jsonl` append-only receipt | provider adapter가 core receipt를 읽고 provider-specific receipt를 별도 artifact로 남긴다 |
| `after_issue_transition` | candidate | `pokit.next`가 다음 issue를 `pending`으로 전환 | none | POK-130 범위 밖. 반복 운영 증거가 쌓이면 별도 issue로 승격 |
| `after_runtime_proof` | candidate | runtime proof artifact가 discovery/trigger/execution level을 갱신 | none | POK-133/160 이후 후보. 본 계약에서는 구현 금지 |
| `on_rework_detected` | candidate | doctor/test가 rework 또는 warning debt를 감지 | none | runtime blocking hook으로 일반화하지 않음 |

Active hook 확장 규칙: candidate hook은 최소 2~3회 반복 수동 비용 증거와 provider-independent natural trigger가 확인되기 전까지 payload schema, receipt schema, doctor guard를 추가하지 않는다.

## Manifest (6 fields)

| 필드 | 값 (현재 hook) | 설명 |
|---|---|---|
| `id` | `after_gate_pass-v0.1` | hook 식별자 (event + 버전) |
| `event` | `after_gate_pass` | 이벤트 이름 |
| `command` | `pokit-runner gate-pass POK-XXX ...` 또는 `git commit -m "... POK-XXX ... gate_passed"` 후 `.githooks/post-commit` | emit을 일으키는 runner/post-commit 경로 |
| `optional` | `false` | runner 내장 + `core.hooksPath=.githooks` 설치 시 자연 경로 |
| `description` | gate pass 시 metrics.json 자동 갱신 + stdout JSON receipt 출력 또는 event-log receipt append | 목적 한 줄 |
| `writes` | `stdout (payload JSON)`, `.ai-os/runs/YYYY-MM-DD/POK-XXX/metrics.json`, `.ai-os/events/event-log.jsonl` | 부수 효과 |

## Payload (7 fields)

stdout에 한 줄 JSON으로 emit된다 (`process.stdout.write(JSON.stringify(payload) + "\n")`).

| 필드 | 타입 | 값 / 출처 |
|---|---|---|
| `schema_version` | string | `"0.1.0"` (이 contract의 버전) |
| `event_name` | string | `"after_gate_pass"` |
| `emitted_at` | string | ISO 8601 UTC (`new Date().toISOString()`) |
| `provider` | enum | `claude_code` \| `codex` \| `antigravity` \| `unknown` (env 자동 감지) |
| `issue_id` | string | `/^POK-\d{3}$/` 통과해야 함 |
| `gate_state` | string | `"gate_passed"` |
| `status` | string | `"gate_passed"` |

### Payload Required / Optional Fields (POK-130)

`after_gate_pass` core payload는 기존 7-field shape를 유지한다. Provider adapter는 아래 required fields를 신뢰할 수 있어야 하며, optional fields가 없다는 이유로 fail하면 안 된다.

Required:

| 필드 | 타입 | 규칙 |
|---|---|---|
| `schema_version` | string | hook contract version. 현재 `"0.1.0"` |
| `event_name` | string | 반드시 `"after_gate_pass"` |
| `emitted_at` | string | ISO 8601 UTC timestamp |
| `provider` | enum | `claude_code` / `codex` / `antigravity` / `unknown` |
| `issue_id` | string | `/^POK-\d{3}$/` |
| `gate_state` | string | 반드시 `"gate_passed"` |
| `status` | string | 반드시 `"gate_passed"` |

Optional, adapter-normalized:

| 필드 | 타입 | 규칙 |
|---|---|---|
| `event_id` | string | 있으면 adapter idempotency key로 우선 사용. 없으면 `event_name + issue_id + emitted_at` 또는 receipt source metadata에서 파생 |
| `source` | enum | `runner` / `git_post_commit` / `backfill` / `unknown` |
| `run_id` | string | metrics path와 연결 가능한 경우만 제공 |
| `gate_commit_sha` | string | git natural path에서 commit sha를 알 수 있을 때만 제공 |
| `metrics_path` | string | `.ai-os/runs/YYYY-MM-DD/POK-XXX/metrics.json`가 확인될 때만 제공 |

Optional field는 v0.11 adapter 편의를 위한 normalized contract다. Core hook runtime은 POK-130에서 이 필드를 새로 emit하도록 변경하지 않는다.

## Event Log Receipt

`git post-commit` 자연 경로는 stdout payload 대신 `.ai-os/events/event-log.jsonl`에 append-only receipt를 남긴다.

필수 필드:

| 필드 | 값 / 출처 |
|---|---|
| `event_type` | `"after_gate_pass"` |
| `event_name` | `"after_gate_pass"` |
| `issue_id` | 감지된 `POK-XXX` |
| `created_at` | `emitted_at`의 `YYYY-MM-DD` |
| `emitted_at` | payload emitted_at |
| `provider` | payload provider |
| `gate_state` | `"gate_passed"` |
| `status` | `"gate_passed"` |
| `payload` | 위 7-field payload 원본 |

POK-140 dogfood evidence:

- `.ai-os/events/event-log.jsonl` has `event_name: "after_gate_pass"` for `issue_id: "POK-140"` with `emitted_at: "2026-05-25T13:08:09.287Z"`.
- The same log shows replay-risk emissions for `POK-164` at `2026-05-25T18:08:36.720Z` and `2026-05-25T18:08:52.598Z`; adapters must therefore separate audit identity from side-effect idempotency.

## Provider Adapter Receipt Schema (POK-130)

Provider adapters do not replace the core event log. They append or write their own receipt artifact after consuming a core `after_gate_pass` event.

Required fields:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string | Adapter receipt schema version. Start with `"0.1.0"` |
| `provider` | enum | Provider that handled the event: `codex` / `claude_code` / `antigravity` / `unknown` |
| `event_id` | string | Stable idempotency key. If core payload lacks one, derive deterministically from source receipt metadata |
| `event_name` | string | `"after_gate_pass"` |
| `issue_id` | string | `/^POK-\d{3}$/` |
| `status` | enum | `handled` / `duplicate` / `skipped` / `failed` |
| `emitted_at` | string | Timestamp from the core event payload |
| `handled_at` | string | Adapter handling timestamp |
| `artifact_path` | string | Path to the adapter proof/receipt artifact, relative to repo root when possible |

Optional fields:

| Field | Type | Rule |
|---|---|---|
| `source_receipt_path` | string | Usually `.ai-os/events/event-log.jsonl` plus enough locator context for audit |
| `source_receipt_offset` | number | Byte or line offset if the adapter can record it cheaply |
| `runtime_proof_path` | string | Example: `.ai-os/runtime-proof/codex.md` for POK-160 |
| `metrics_path` | string | Existing metrics artifact if available |
| `error_code` | string | Required when `status: failed` and useful for retry classification |
| `message` | string | Short human-readable note; not a substitute for structured fields |

MVP artifact path recommendation:

```text
.ai-os/events/provider-receipts/<provider>/<event_id>.json
```

POK-160 may choose an equivalent path if it records the chosen path in its Implementation Brief and keeps `artifact_path` in every receipt.

## Retry and Idempotency Rules (POK-130)

| Case | Adapter behavior |
|---|---|
| Same side-effect idempotency key already has `handled` receipt | Do not re-run side effects. Emit or preserve a `duplicate` receipt only if useful for audit |
| Same `event_name + issue_id` with different `emitted_at` | Treat as replay-risk, not automatically as a new side effect. Use the strongest source key below before mutating provider state |
| Core payload lacks `event_id` | Derive two keys: an audit key and a side-effect idempotency key. The audit key may include line locator or `emitted_at`; the side-effect key must prefer stable source identity |
| Adapter crashes before writing receipt | Retry may re-run. Side effects must be guarded by the same idempotency key |
| Adapter sees malformed required field | Write `failed` receipt if enough fields exist to identify the event; otherwise log diagnostic in provider proof and do not mutate core event log |
| Provider-specific output path already exists | Verify it matches the same `event_id`; if yes, treat as duplicate, if no, fail with path collision |

Side-effect idempotency key order:

1. `gate_commit_sha + event_name + issue_id`, when commit sha is known.
2. Provider artifact identity already created for the same `issue_id` and gate state.
3. `event_name + issue_id`, only when the adapter's action is issue-level and must run once per gate pass.
4. `event_name + issue_id + emitted_at`, only for audit-only handling or explicitly repeatable side effects.

Event-log line locator and `emitted_at` are useful audit identity. They are not enough by themselves to justify repeating external provider side effects.

Core hook retry policy: core hook emits append-only evidence and does not call provider adapters directly in POK-130. Provider adapters own retry loops, duplicate suppression, and provider-specific failure classification.

## Core Hook vs Provider Adapter Responsibility

| Responsibility | Core hook contract | Provider adapter |
|---|---|---|
| Define active event catalog | Owns `after_gate_pass` active MVP event | Reads catalog; does not add core events |
| Detect natural trigger | Owns runner/post-commit/backfill natural path | Does not redefine trigger semantics |
| Emit core payload | Owns 7 required payload fields | Validates and normalizes optional derived fields |
| Append core event log | Owns `.ai-os/events/event-log.jsonl` receipt | Never rewrites core event log |
| Provider detection | Best-effort `provider` field only | Owns provider-specific runtime/session evidence |
| Adapter receipt | Out of scope | Owns schema above and `artifact_path` |
| Retry/idempotency | Append-only core evidence only | Owns idempotency key, duplicate handling, retry safety |
| Runtime proof claim | Out of scope | Must follow `.ai-os/standards/runtime-proof.md` |
| Doctor/test guard implementation | Out of scope for POK-130 | May propose guards in later issue; POK-130 adds no guard code |

## POK-160 Implementation Brief Input

POK-160 Codex adapter should consume this contract as follows:

1. Read core `after_gate_pass` evidence from `.ai-os/events/event-log.jsonl` or runner stdout.
2. Validate required payload fields without requiring optional normalized fields.
3. Derive or read `event_id` and use it as the idempotency key.
4. Write an adapter receipt containing `provider`, `event_id`, `status`, `emitted_at`, and `artifact_path`.
5. Link the receipt to `.ai-os/runtime-proof/codex.md` only when Codex proof evidence is actually recorded.
6. Keep implementation out of the core hook runtime unless a later issue explicitly promotes that change.

설치:

```bash
npm run hooks:install
```

누락 backfill:

```bash
npm run hooks:backfill
```

## Provider 감지 규칙

env 변수 우선순위 (위에서부터 검사, 첫 번째 매치 채택):

| Provider | env (둘 중 하나라도 set이면 매치) |
|---|---|
| `claude_code` | `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT` |
| `codex` | `CODEX_ENV`, `CODEX_SESSION_ID` |
| `antigravity` | `ANTIGRAVITY`, `ANTIGRAVITY_SESSION` |
| `unknown` | 위 어디에도 매치 안 됨 |

구현: `scripts/lib/hook-emit.mjs#detectProvider`.

## Token Fallback 정책

token 사용량은 LLM provider가 emit 시점에 직접 제공하지 않으므로 best-effort로 수집한다.

- POK-141 이후 token CLI 플래그 (`--input-tokens` 등)는 optional이다.
- 미제공 시 metrics.json에는 `0`으로 기록하되 `metrics_tokens_missing` warning은 내지 않는다.
- token 부재는 **gate fail 아님**. POKit 철학 5 ("흐름 방해 금지") 준수.

## Hook Enforcement Matrix (POK-165)

새 표준/스킬/명령이 `MUST` / "필수" / "강제"를 추가할 때는 아래 등급 중 하나를 명시한다. hook/doctor가 파일, runner output, receipt, metrics, 또는 issue card를 읽어 판정할 수 있으면 hook-enforceable로 올린다. 순수 LLM 응답처럼 자연 경로에서 차단할 수 없는 항목은 LLM-response-only로 남기되 runtime proof 또는 deferred evidence를 요구한다.

| Contract item | Enforcement class | Evidence token / path | Gate expectation |
|---|---|---|---|
| `after_gate_pass` receipt | hook-enforceable | `.ai-os/events/event-log.jsonl`, `event_name: after_gate_pass` | missing receipt is doctor fail after natural-path hook is installed |
| v0.10+ Workflow Trace | doctor-enforceable | issue card `## Workflow Trace`, `Step 2:`, `Workers:` | `sprint: v0.10.0+` and `gate_state: gate_passed` without trace is fail unless explicit skip reason exists |
| Metrics evidence | doctor-enforceable | `.ai-os/runs/YYYY-MM-DD/POK-XXX/metrics.json` | v0.10+ gate-passed issue must have metrics evidence or a documented transitional warning policy |
| `/pokit.issue` authoring evidence | doctor-enforceable | issue card `authoring_path: pokit.issue|natural-language-issue-authoring`, `authoring_contract_version` | new/updated issue cards must record the authoring path or explicit legacy exception |
| `/pokit.issue` template/command drift | doctor-enforceable | `.ai-os/templates/commands/issue.md`, `.claude/commands/pokit.issue.md`, shared tokens | template and Claude command must share required contract tokens |
| Codex installed skill drift | doctor-enforceable | `$CODEX_HOME/skills/pokit-issue/SKILL.md` or `~/.codex/skills/pokit-issue/SKILL.md` | installed Codex skill must include current critical tokens or report fail/warning by policy |
| Subagent/fallback evidence | doctor-enforceable | `Workers:`, `Fallback reason:`, `needs_subagent_authorization`, `worker-unavailable` | `Workers: none` requires enum fallback evidence; authorization-missing is not fallback |
| Runner-rendered lifecycle cards | test-enforceable | renderer fixtures, `renderedLifecycleCard` exact output | runner/hook path must use renderer fixture; drift is test fail |
| Lifecycle source labels | test-enforceable | renderer fixtures with `hook`, `runner`, `LLM 판단`, `human` labels | startup/progress/session-close cards may carry source labels; renderer drift is test fail |
| Pure LLM response lifecycle text | LLM-response-only | runtime proof, POK-150 deferred evidence | cannot be blocked by hook directly; require runtime proof or explicit deferred evidence |

Enforcement class definitions:

| Class | Meaning |
|---|---|
| `hook-enforceable` | A natural-path hook can emit, block, or append receipt during the workflow. |
| `doctor-enforceable` | `pokit-doctor` can inspect repo/state/run artifacts and fail or warn. |
| `test-enforceable` | A fixture or unit test can lock renderer/command behavior. |
| `LLM-response-only` | No reliable hook surface exists for the live prose response; use runtime proof/deferred evidence instead. |

Required POK-165 contract tokens for sync checks:

```text
Hook Enforcement Matrix
authoring_path
authoring_contract_version
Workflow Trace
Workers:
Fallback reason:
needs_subagent_authorization
worker-unavailable
metrics.json
renderedLifecycleCard
LLM-response-only
```

## 확장 규칙

새 hook(예: `after_commit`, `on_rework`)을 추가할 때는 다음 조건을 모두 충족한 뒤 이 문서를 확장한다.

1. 실제 자동화 가치가 반복 관측되었다 (최소 2~3회의 수동 비용 증거).
2. Provider 중립적으로 구현 가능하다 (특정 runtime의 native hook에만 의존하지 않음).
3. payload는 emit이 살아 움직인 뒤 추출한다 — 종이 위에서 먼저 28 필드를 그리지 않는다.

POKit 로드맵 Phase 5: *"초기에는 hook을 자동 실행하지 않아도 된다. 먼저 체크리스트와 AGENTS/CLAUDE 규칙으로 운영하고, 반복되는 검증만 승격한다."*

## References

- `docs/research/benchmarks/v2-external-systems.md` — Appendix A (13 event / 15 manifest / 28 payload 큰 그림 reference)
- `scripts/lib/hook-emit.mjs` — payload 빌더 + provider 자동 감지 구현
- `scripts/lib/after-gate-pass-natural-hook.mjs` — post-commit 감지 + event-log append + backfill
- `.githooks/post-commit` — git natural-path wrapper
- `scripts/pokit-post-commit-hook.mjs` — post-commit node entrypoint
- `scripts/pokit-backfill-after-gate-pass.mjs` — 최근 gate_passed 커밋 누락 receipt backfill
- `scripts/pokit-runner.mjs` — `gate-pass` CLI 경로 (inline emit)
- `scripts/lib/issue-metrics.mjs` — 15-field metrics 스키마 (POK-097, POK-122)
- `scripts/pokit-doctor.mjs` — 최근 gate_passed 커밋 ↔ after_gate_pass receipt 정합성 fail guard
- `projects/pokit/issues/POK-128.md` — 본 contract의 origin issue
- `projects/pokit/issues/POK-140.md` — post-commit 자연 경로 승격 issue
- `projects/pokit/issues/POK-165.md` — Hook Enforcement Matrix, Codex installed skill drift, `/pokit.issue` authoring drift
