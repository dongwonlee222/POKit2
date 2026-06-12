// POK-326 — 사용자 개선 피드백 카드: 회고·메트릭·실패 루프를 PO에게 환류한다.
// 외부 의존성 없음 (Node built-ins + 동일 디렉터리의 yaml-lite.mjs).

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parseYamlLite } from './yaml-lite.mjs';

// ── Pure functions ─────────────────────────────────────────────────────────────

/**
 * `ai-failure-log.md` 본문에서 fenced ```yaml 블록을 찾아 4개 필드를 추출한다.
 * YAML 파서를 쓰지 않는다 — 중첩 리스트 등 비정형 항목이 섞여 있기 때문.
 * prevention_rule 또는 detected_at 이 없는 블록은 건너뛴다.
 *
 * @param {string} failureLogText
 * @returns {{ failureId: string, preventionRule: string, detectedAt: string, summary: string }[]}
 */
export function parseFailureLogEntries(failureLogText) {
  const entries = [];
  // ```yaml ... ``` 블록 추출 (non-greedy)
  const blockRe = /```yaml\n([\s\S]*?)```/g;
  let match;
  while ((match = blockRe.exec(failureLogText)) !== null) {
    const block = match[1];

    const failureId = extractScalarLine(block, 'failure_id');
    const preventionRule = extractScalarLine(block, 'prevention_rule');
    const detectedAt = extractScalarLine(block, 'detected_at');
    const rawSummary = extractScalarLine(block, 'summary');

    // 필수 필드 누락 시 건너뜀
    if (!preventionRule || !detectedAt) continue;

    // summary: 쌍따옴표 둘러싸인 경우 제거
    const summary = rawSummary ? rawSummary.replace(/^"(.*)"$/, '$1') : '';

    entries.push({ failureId: failureId ?? '', preventionRule, detectedAt, summary });
  }
  return entries;
}

/** 블록 내 `key: value` 한 줄 스칼라 추출 (들여쓰기 무관). */
function extractScalarLine(block, key) {
  const re = new RegExp(`^[ \\t]*${key}:\\s*(.+)$`, 'm');
  const m = re.exec(block);
  return m ? m[1].trim() : null;
}

/**
 * sinceDate 이후 발생한 실패 항목 중 같은 preventionRule 이 minCount 회 이상 반복된
 * 규칙을 내림차순으로 반환한다.
 *
 * sinceDate 가 falsy 이면 과알림 방지로 빈 배열을 반환한다(fail-closed silent).
 *
 * @param {{ failureLogText: string, sinceDate: string|null|undefined, minCount?: number }}
 * @returns {{ rule: string, count: number, lastDetectedAt: string, summary: string }[]}
 */
export function detectRepeatedRules({ failureLogText, sinceDate, minCount = 2 }) {
  if (!sinceDate) return [];

  const entries = parseFailureLogEntries(failureLogText);
  // sinceDate 이후 항목만 (YYYY-MM-DD 문자열 비교)
  const inWindow = entries.filter((e) => e.detectedAt >= sinceDate);

  // preventionRule별 그룹화
  const map = new Map(); // rule → { count, lastDetectedAt, summary }
  for (const entry of inWindow) {
    const rule = entry.preventionRule;
    const existing = map.get(rule);
    if (!existing) {
      map.set(rule, { count: 1, lastDetectedAt: entry.detectedAt, summary: entry.summary });
    } else {
      existing.count += 1;
      // 더 늦은 날짜 기준
      if (entry.detectedAt > existing.lastDetectedAt) {
        existing.lastDetectedAt = entry.detectedAt;
        existing.summary = entry.summary;
      }
    }
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.count >= minCount)
    .map(([rule, v]) => ({ rule, count: v.count, lastDetectedAt: v.lastDetectedAt, summary: v.summary }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 이슈별 metrics 오브젝트 배열을 집계한다.
 * duration_ms > 0 → 측정됨; total_tokens > 0 → 수집됨.
 * changed_files / changed_lines / rework_count 는 누락을 0으로 간주해 단순 합산.
 *
 * @param {{ issueId: string, metrics: object }[]} metricsList
 * @returns {object}
 */
export function aggregateRunMetrics(metricsList) {
  let durationMsTotal = 0;
  let durationMeasuredCount = 0;
  let durationMissingCount = 0;
  let changedFiles = 0;
  let changedLines = 0;
  let reworkCount = 0;
  let tokensTotal = 0;
  let tokensCollectedCount = 0;
  let tokensMissingCount = 0;

  for (const { metrics } of metricsList) {
    const m = metrics ?? {};

    if ((m.duration_ms ?? 0) > 0) {
      durationMsTotal += m.duration_ms;
      durationMeasuredCount += 1;
    } else {
      durationMissingCount += 1;
    }

    changedFiles += m.changed_files ?? 0;
    changedLines += m.changed_lines ?? 0;
    reworkCount += m.rework_count ?? 0;

    if ((m.total_tokens ?? 0) > 0) {
      tokensTotal += m.total_tokens;
      tokensCollectedCount += 1;
    } else {
      tokensMissingCount += 1;
    }
  }

  return {
    issueCount: metricsList.length,
    durationMsTotal,
    durationMeasuredCount,
    durationMissingCount,
    changedFiles,
    changedLines,
    reworkCount,
    tokensTotal,
    tokensCollectedCount,
    tokensMissingCount,
  };
}

/**
 * retro.md 본문에서 `## 3. 아쉬운 것` 섹션의 볼드 앞머리(`- **lead**: ...`)를 추출한다.
 * 최대 5개. 섹션이 없으면 빈 배열.
 *
 * @param {string} retroText
 * @returns {string[]}
 */
export function extractRetroShortcomings(retroText) {
  const sectionRe = /^## 3\. .*/m;
  const match = sectionRe.exec(retroText);
  if (!match) return [];

  const afterSection = retroText.slice(match.index + match[0].length);
  // 다음 `## ` 헤딩 전까지만
  const nextHeading = /^## /m.exec(afterSection);
  const sectionText = nextHeading ? afterSection.slice(0, nextHeading.index) : afterSection;

  const bullets = [];
  const bulletRe = /^- \*\*([^*]+)\*\*/gm;
  let bm;
  while ((bm = bulletRe.exec(sectionText)) !== null && bullets.length < 5) {
    bullets.push(bm[1]);
  }
  return bullets;
}

/**
 * ms → 한국어 시간 문자열.
 * @param {number} ms
 * @returns {string}
 */
export function formatDurationKo(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalMinutes < 1) return '1분 미만';
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

/**
 * 스프린트 피드백 카드를 렌더링한다.
 * model 형태: { sprintVersion, aggregate, shortcomings, repeatedRules, retroExists }
 *
 * @param {object} model
 * @returns {string}
 */
export function renderSprintFeedbackCard(model) {
  const { sprintVersion, aggregate, shortcomings, repeatedRules, retroExists } = model;
  const {
    issueCount,
    durationMsTotal,
    durationMeasuredCount,
    durationMissingCount,
    changedFiles,
    changedLines,
    reworkCount,
    tokensTotal,
    tokensCollectedCount,
    tokensMissingCount,
  } = aggregate;

  // 걸린 시간 라인
  let durationLine;
  if (durationMeasuredCount === 0) {
    durationLine = '│   걸린 시간    미수집';
  } else {
    durationLine = `│   걸린 시간    합계 ${formatDurationKo(durationMsTotal)} (측정 ${durationMeasuredCount}건 / 미수집 ${durationMissingCount}건)`;
  }

  // 토큰 사용 라인
  let tokensLine;
  if (tokensCollectedCount === 0) {
    tokensLine = '│   토큰 사용    미수집';
  } else {
    tokensLine = `│   토큰 사용    ${tokensTotal.toLocaleString('en-US')} (수집 ${tokensCollectedCount}건 / 미수집 ${tokensMissingCount}건)`;
  }

  // 아쉬웠던 점
  let shortcomingsBlock;
  if (!retroExists) {
    shortcomingsBlock = `│   - 회고가 아직 없어요 (docs/${sprintVersion}/retro.md 미작성)`;
  } else if (shortcomings.length === 0) {
    shortcomingsBlock = '│   - 기록된 아쉬운 점이 없어요';
  } else {
    shortcomingsBlock = shortcomings.map((s) => `│   - ${s}`).join('\n');
  }

  // 반복 실수 섹션
  let repeatBlock;
  if (repeatedRules.length === 0) {
    repeatBlock = '│   - 이번 스프린트엔 반복된 실수가 없었어요';
  } else {
    const top = repeatedRules[0];
    const truncSummary = top.summary.length > 60 ? `${top.summary.slice(0, 60)}…` : top.summary;
    repeatBlock =
      `│   - ${top.rule} — 같은 실수가 이번에 ${top.count}번 있었어요: ${truncSummary}\n` +
      `│     시작 전에 이 항목만 먼저 확인하면 반복을 줄일 수 있어요.`;
  }

  return [
    `╭─ 🪞 이번 스프린트 돌아보기 — ${sprintVersion}`,
    '│',
    '│ 이렇게 했어요',
    `│   끝낸 일      ${issueCount}건`,
    durationLine,
    `│   고친 파일    ${changedFiles}개 / ${changedLines}줄`,
    `│   다시 한 작업 ${reworkCount}회`,
    tokensLine,
    '│',
    '│ 아쉬웠던 점 (회고에서)',
    shortcomingsBlock,
    '│',
    '│ 다음번엔 미리 점검할까요?',
    repeatBlock,
    '╰─',
  ].join('\n');
}

/**
 * 반복 실수 단독 카드를 렌더링한다.
 *
 * @param {{ sprintVersion: string, rule: string, count: number, summary: string }}
 * @returns {string}
 */
export function renderRepeatRuleCard({ sprintVersion, rule, count, summary }) {
  const truncSummary = summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
  return [
    `╭─ 🪞 같은 실수가 반복되고 있어요 — ${sprintVersion}`,
    '│',
    `│ ${rule} 항목이 이번 스프린트에서 ${count}번 발생했어요.`,
    `│   무슨 일    ${truncSummary}`,
    '│   제안       다음 작업을 시작하기 전에 이 항목을 미리 점검해 보세요.',
    '╰─',
  ].join('\n');
}

// ── Async I/O functions ────────────────────────────────────────────────────────

/**
 * 주어진 이슈 id에 대해 `.ai-os/runs/YYYY-MM-DD/{issueId}/metrics.json` 중
 * 가장 최신 날짜 디렉터리의 metrics.json을 읽어 반환한다. 없으면 null.
 *
 * @param {string} root
 * @param {string} issueId
 * @returns {Promise<object|null>}
 */
async function readLatestMetrics(root, issueId) {
  const runsDir = join(root, '.ai-os', 'runs');
  let dateDirs;
  try {
    dateDirs = await readdir(runsDir);
  } catch {
    return null;
  }

  // YYYY-MM-DD 형식 디렉터리만, 내림차순 정렬 (최신 먼저)
  const sorted = dateDirs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();

  for (const dateDir of sorted) {
    const metricsPath = join(runsDir, dateDir, issueId, 'metrics.json');
    try {
      const raw = await readFile(metricsPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      // 이 날짜 디렉터리엔 없음, 다음 날짜 시도
    }
  }
  return null;
}

/**
 * 스프린트 피드백 카드 모델을 수집한다.
 *
 * @param {{ root: string, sprintVersion: string }}
 * @returns {Promise<object>}
 */
export async function collectSprintFeedbackModel({ root, sprintVersion }) {
  // release-scope.yaml 읽기
  const releaseScopePath = join(root, '.ai-os', 'sprints', sprintVersion, 'release-scope.yaml');
  const scopeRaw = await readFile(releaseScopePath, 'utf8');
  const scope = parseYamlLite(scopeRaw);
  const scopeDecidedAt = scope.scope_decided_at ?? null;

  // gate_passed 이슈 목록 수집 (accepted + candidates 모두)
  const allEntries = [...(scope.accepted ?? []), ...(scope.candidates ?? [])];
  const passedEntries = allEntries.filter((e) => e.status === 'gate_passed');

  // 이슈별 metrics 수집
  const metricsList = [];
  for (const entry of passedEntries) {
    const metrics = await readLatestMetrics(root, entry.id);
    metricsList.push({ issueId: entry.id, metrics: metrics ?? {} });
  }
  const aggregate = aggregateRunMetrics(metricsList);

  // 실패 로그
  const failureLogPath = join(root, '.ai-os', 'memory', 'ai-failures', 'ai-failure-log.md');
  let repeatedRules = [];
  try {
    const failureLogText = await readFile(failureLogPath, 'utf8');
    repeatedRules = detectRepeatedRules({ failureLogText, sinceDate: scopeDecidedAt });
  } catch {
    // 실패 로그 없어도 카드는 출력
  }

  // 회고 §3
  const retroPath = join(root, 'docs', sprintVersion, 'retro.md');
  let shortcomings = [];
  let retroExists = false;
  try {
    const retroText = await readFile(retroPath, 'utf8');
    retroExists = true;
    shortcomings = extractRetroShortcomings(retroText);
  } catch {
    retroExists = false;
  }

  return { sprintVersion, aggregate, shortcomings, repeatedRules, retroExists };
}

/**
 * 현재 스프린트에서 반복된 실수가 있으면 단독 카드를 반환한다. 없으면 null.
 * 어떤 오류도 외부로 던지지 않는다 (issue-completion 길목에서 호출되므로).
 *
 * @param {{ root: string }}
 * @returns {Promise<string|null>}
 */
export async function maybeBuildRepeatRuleCard({ root }) {
  try {
    // current.md 에서 active_sprint 읽기
    const currentPath = join(root, '.ai-os', 'current.md');
    const currentText = await readFile(currentPath, 'utf8');
    const sprintVersion = parseFrontmatterField(currentText, 'active_sprint');
    if (!sprintVersion) return null;

    // release-scope.yaml 에서 scope_decided_at 읽기
    const releaseScopePath = join(root, '.ai-os', 'sprints', sprintVersion, 'release-scope.yaml');
    const scopeRaw = await readFile(releaseScopePath, 'utf8');
    const scope = parseYamlLite(scopeRaw);
    const sinceDate = scope.scope_decided_at ?? null;
    if (!sinceDate) return null;

    // 실패 로그
    const failureLogPath = join(root, '.ai-os', 'memory', 'ai-failures', 'ai-failure-log.md');
    const failureLogText = await readFile(failureLogPath, 'utf8');
    const repeated = detectRepeatedRules({ failureLogText, sinceDate });
    if (repeated.length === 0) return null;

    const top = repeated[0];
    return renderRepeatRuleCard({ sprintVersion, rule: top.rule, count: top.count, summary: top.summary });
  } catch {
    return null;
  }
}

/** YAML 프론트매터에서 `key: value` 스칼라를 추출한다 — `---` 블록 내부만 본다 (본문 오매칭 방지). */
function parseFrontmatterField(text, key) {
  const block = text.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const m = re.exec(block[1]);
  return m ? m[1].trim() : null;
}
