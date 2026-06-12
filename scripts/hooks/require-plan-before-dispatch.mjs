#!/usr/bin/env node
/**
 * POK-228 AC4 / POK-234 — Claude Code PreToolUse hook: gate worker dispatch on plan-presence
 * AND routing-decision receipt.
 *
 * This is the real chokepoint guard for the execution-approval flow. It triggers on
 * write-scoped or unknown `Task` tool calls (worker/subagent dispatch) and DENIES a dispatch that jumped
 * straight to fan-out without first calling the runner on "b" (the second runner
 * call that emits the post_runner_plan checkpoint + post_runner_execution_lock) AND
 * without the reasoning layer emitting a routing_decision receipt (skill Step 0).
 *
 * Read-only split (POK-291):
 *   Explicit read_only Task calls bypass this durable-dispatch guard. That allow is
 *   not runtime execution proof; it only says the call did not request file mutation.
 *   Unknown intent remains guarded.
 *
 * Why also require routing_decision (POK-234)?
 *   `routing_decision` is emitted by reasoning (skill Step 0), NOT by the runner, to
 *   prevent runner self-certification. The runner deliberately does NOT emit this receipt
 *   so it cannot prove that the correct skill path was selected. Enforcing its presence
 *   here makes Step 0 impossible to skip silently: if the event is absent the dispatch is
 *   denied and the operator is told exactly which command to run.
 *
 * Decision rules (fail-closed on missing plan/routing, FAIL-OPEN on internal error):
 *   1. Read .ai-os/current.md → active_issue + gate_state.
 *   2. gate_state NOT in {pending, in_progress} → ALLOW (nothing to guard).
 *   3. Else require ALL THREE for the active issue in the event log:
 *        - a `post_runner_execution_lock` event, AND
 *        - a `skill_execution_checkpoint` with step `post_runner_plan`, AND
 *        - a `routing_decision` event with selected_skill='pokit.issue' and
 *          request_class='issue_execution' (emitted by skill Step 0, never by the runner).
 *      All present → ALLOW. Any missing → DENY (actionable Korean reason listing missing prereqs).
 *   4. Any thrown error (can't read current.md / event log / parse) → ALLOW + stderr warn.
 *
 * I/O protocol mirrors scripts/hooks/block-issue-card-write.mjs:
 *   ALLOW = exit 0, NO output (printing permissionDecision:"allow" would bypass the
 *           user's normal permission prompts — so we emit nothing).
 *   DENY  = print hookSpecificOutput JSON to stdout, exit 0.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readActiveIssueForWorktree } from '../lib/worktree-active-issue.mjs';
import { classifyTaskScope, TASK_SCOPE } from '../lib/task-scope-classifier.mjs';

const CURRENT_MD_REL = '.ai-os/current.md';
const EVENT_LOG_REL = '.ai-os/events/event-log.jsonl';
const ISSUES_DIR_GLOB_REL = 'projects'; // scan projects/*/issues/

// POK-258: 정확 패턴 SSoT 통일 예정(여기선 prefix-agnostic 인라인)
// prefix-agnostic: POK-, GG-, MODU-, COM- 등 [A-Z][A-Z0-9]*-\d+.md 형식 모두 매칭
const ISSUE_FILE_RE = /^[A-Z][A-Z0-9]*-\d+\.md$/;

const GUARDED_GATE_STATES = new Set(['pending', 'in_progress']);

const POST_RUNNER_EXECUTION_LOCK_EVENT = 'post_runner_execution_lock';
const SKILL_EXECUTION_CHECKPOINT_EVENT = 'skill_execution_checkpoint';
const POST_RUNNER_PLAN_STEP = 'post_runner_plan';
const ROUTING_DECISION_EVENT = 'routing_decision';
const ROUTING_REQUIRED_SKILL = 'pokit.issue';
const ROUTING_REQUIRED_CLASS = 'issue_execution';

const DENY_REASON =
  "워커 분배 전에 'b/자동' 러너 호출(post_runner_plan)이 필요합니다. " +
  'node scripts/pokit-runner.mjs "b" 를 먼저 실행하세요.';

function allow() {
  return { decision: 'allow' };
}

function deny(reason = DENY_REASON) {
  return { decision: 'deny', reason };
}

/**
 * Parse the active_issue + gate_state from current.md frontmatter text.
 * @param {string} currentMd
 * @returns {{ activeIssue: string|null, gateState: string|null }}
 */
function parseCurrentMd(currentMd) {
  const text = typeof currentMd === 'string' ? currentMd : '';
  const activeMatch = text.match(/^\s*active_issue:\s*(\S+)\s*$/m);
  const gateMatch = text.match(/^\s*gate_state:\s*(\S+)\s*$/m);
  return {
    activeIssue: activeMatch ? activeMatch[1].trim() : null,
    gateState: gateMatch ? gateMatch[1].trim() : null,
  };
}

/**
 * 프로젝트 루트 아래 projects/<proj>/issues/ 디렉터리를 스캔해
 * prefix-agnostic 이슈 파일이 하나라도 있는지 판정한다.
 *
 * 판정 기준: 파일명이 ISSUE_FILE_RE 패턴에 매칭되는 파일.
 * (POK-258: 정확 자릿수 SSoT 통일 예정, 여기선 인라인)
 *
 * @param {string} root - 프로젝트 루트 절대 경로
 * @returns {Promise<boolean>}
 */
export async function hasAnyIssue(root) {
  const projectsDir = path.join(root, ISSUES_DIR_GLOB_REL);
  let projectEntries;
  try {
    projectEntries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return false; // projects/ 없음 → 이슈 0개
  }
  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) continue;
    const issuesDir = path.join(projectsDir, projectEntry.name, 'issues');
    let issueEntries;
    try {
      issueEntries = await readdir(issuesDir, { withFileTypes: true });
    } catch {
      continue; // issues/ 없음 → 다음 프로젝트
    }
    for (const issueEntry of issueEntries) {
      if (issueEntry.isFile() && ISSUE_FILE_RE.test(issueEntry.name)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pure decision function — exported for unit testing.
 *
 * @param {object} args
 * @param {string} args.currentMd - raw text of .ai-os/current.md
 * @param {Array<object>} args.events - parsed event-log entries (one object per jsonl line)
 * @param {boolean} [args.anyIssueExists] - 이슈 존재 여부 (테스트 주입용).
 *   main()에서는 hasAnyIssue() 실제 스캔 결과를 전달.
 *   undefined 시 기존 동작 유지(active_issue 없으면 allow — 하위호환).
 *   true 전달 시: active_issue 없으면 fail-closed (deny).
 *   false 전달 시: 이슈 0개 부트스트랩 → allow.
 * @returns {{ decision: 'allow'|'deny', reason?: string }}
 */
export function decide({ currentMd, events, anyIssueExists, activeIssueOverride = null } = {}) {
  const parsed = parseCurrentMd(currentMd);
  const activeIssue = activeIssueOverride ?? parsed.activeIssue;
  const gateState = parsed.gateState;

  // active_issue 없는 경우 처리:
  if (!activeIssue) {
    if (anyIssueExists === true) {
      // 이슈가 존재하는데 active_issue가 없음 → fail-closed
      return deny(
        'active_issue 없이 워커를 분배할 수 없습니다 — 이슈를 먼저 바인딩하세요' +
          '(node scripts/pokit-issue-use.mjs <ID> 또는 /pokit.backlog).'
      );
    }
    // anyIssueExists === false (부트스트랩) 또는 undefined (하위호환) → allow
    return allow();
  }

  // active_issue 있지만 gateState 없음 → guarded 아님 → allow
  if (!gateState) return allow();

  // Only guard the active execution window.
  if (!GUARDED_GATE_STATES.has(gateState)) return allow();

  const list = Array.isArray(events) ? events : [];

  let hasLock = false;
  let hasPlan = false;
  let hasRouting = false;
  for (const event of list) {
    if (!event || typeof event !== 'object') continue;
    if (event.issue_id !== activeIssue) continue;

    const eventType = event.event_type ?? event.event_name;
    if (eventType === POST_RUNNER_EXECUTION_LOCK_EVENT) {
      hasLock = true;
    } else if (eventType === SKILL_EXECUTION_CHECKPOINT_EVENT) {
      const step = event.step ?? event.payload?.step;
      if (step === POST_RUNNER_PLAN_STEP) hasPlan = true;
    } else if (eventType === ROUTING_DECISION_EVENT) {
      const selectedSkill = event.selected_skill ?? event.payload?.selected_skill;
      const requestClass = event.request_class ?? event.payload?.request_class;
      if (selectedSkill === ROUTING_REQUIRED_SKILL && requestClass === ROUTING_REQUIRED_CLASS) {
        hasRouting = true;
      }
    }

    if (hasLock && hasPlan && hasRouting) return allow();
  }

  if (hasLock && hasPlan && hasRouting) return allow();

  // Build an actionable reason listing which prerequisites are missing.
  // Include lock so the message never falls back to a stale/misleading default
  // when only the lock is absent (plan+routing present).
  const missing = [];
  if (!hasLock) {
    missing.push("post_runner_execution_lock (러너 'b/자동' 호출: node scripts/pokit-runner.mjs \"b\")");
  }
  if (!hasPlan) {
    missing.push("post_runner_plan (러너 'b/자동' 호출: node scripts/pokit-runner.mjs \"b\")");
  }
  if (!hasRouting) {
    missing.push(
      `routing_decision (스킬 Step 0: node scripts/pokit-routing-decision.mjs --issue ${activeIssue} --selected-skill pokit.issue --request-class issue_execution --decision-reason "<why>")`
    );
  }

  const reason =
    missing.length > 0
      ? `워커 분배 전에 다음 선행 조건이 누락되었습니다:\n${missing.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}`
      : DENY_REASON;

  return deny(reason);
}

// POK-328 — 워커 git 경계 길목 가드. 워커의 git commit/push 금지는 SKILL 계약에
// 있었지만 집행이 "디스패치 프롬프트에 그 줄을 기억해서 넣는 것"에 의존했고,
// 실제로 한 워커가 무단 commit/push를 수행했다 (95f12176). 모든 write-scoped
// 디스패치가 지나는 이 길목에서 프롬프트에 금지 문구가 있는지 검사한다.
const WORKER_GIT_PROHIBITION_RE =
  /(git\s*(commit|push)?[^\n]{0,40}(금지|forbidden)|do\s+not\s+(commit|push)|don'?t\s+(commit|push)|커밋.{0,20}금지|no\s+git\s+(commit|push))/i;

export function hasGitProhibition(prompt) {
  return WORKER_GIT_PROHIBITION_RE.test(String(prompt ?? ''));
}

export function decideTaskDispatch({
  currentMd,
  events,
  anyIssueExists,
  activeIssueOverride = null,
  payload = null,
} = {}) {
  const taskScope = classifyTaskScope(payload ?? {});
  if (taskScope === TASK_SCOPE.READ_ONLY) return allow();

  // POK-328 — write-scoped/unknown 워커 프롬프트는 git 금지 문구를 반드시 포함해야
  // 출발할 수 있다 (예: "git commit/push 금지" 또는 "Do NOT commit or push").
  const prompt = payload?.tool_input?.prompt ?? '';
  if (prompt && !hasGitProhibition(prompt)) {
    return deny(
      '워커 디스패치 프롬프트에 git 경계 문구가 없습니다. ' +
        '프롬프트에 "git commit/push 금지 — 커밋·푸시는 main 세션 소유" 한 줄을 넣고 다시 보내세요 (POK-328 워커 경계).'
    );
  }

  return decide({ currentMd, events, anyIssueExists, activeIssueOverride });
}

/**
 * Read + parse the event log into an array of objects. Missing log → [].
 */
async function loadEvents(root) {
  const logPath = path.join(root, EVENT_LOG_REL);
  let text;
  try {
    text = await readFile(logPath, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Skip malformed lines.
    }
  }
  return events;
}

function outputDeny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }) + '\n'
  );
}

function outputAllow() {
  // Emit NOTHING on allow — printing permissionDecision:"allow" would auto-approve
  // and bypass the user's normal permission prompts (see block-issue-card-write.mjs).
}

async function main() {
  let raw = '';
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch {
    outputAllow();
    return;
  }

  let payload;
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    // Unparseable stdin — allow (never crash user flow).
    outputAllow();
    return;
  }

  // Only guard the Task tool (worker/subagent dispatch). Anything else → allow.
  const toolName = payload?.tool_name ?? '';
  if (toolName !== 'Task') {
    outputAllow();
    return;
  }

  // FAIL-OPEN: any error reading state / event log → allow + warn (never block on a hook bug).
  let result;
  try {
    const root = process.cwd();
    let currentMd = '';
    try {
      currentMd = await readFile(path.join(root, CURRENT_MD_REL), 'utf8');
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
      // No current.md → nothing to guard.
      outputAllow();
      return;
    }
    const events = await loadEvents(root);
    const anyIssueExists = await hasAnyIssue(root);
    let activeIssueOverride = null;
    try {
      activeIssueOverride = (await readActiveIssueForWorktree(root)).activeIssue;
    } catch {
      activeIssueOverride = null;
    }
    result = decideTaskDispatch({ currentMd, events, anyIssueExists, activeIssueOverride, payload });
  } catch (err) {
    process.stderr.write(
      `warn: require-plan-before-dispatch hook failed open (allowing dispatch): ${err?.message ?? err}\n`
    );
    outputAllow();
    return;
  }

  if (result.decision === 'deny') {
    outputDeny(result.reason ?? DENY_REASON);
  } else {
    outputAllow();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
