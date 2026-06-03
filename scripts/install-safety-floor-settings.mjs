#!/usr/bin/env node
/**
 * 스타터 settings.json 비파괴 병합 유틸.
 *
 * 설계 계약: starter safety floor contract (settings merge + hook installation)
 *
 * 사용자 기존 설정을 건드리지 않고 안전바닥 훅 항목만 추가한다.
 * 충돌 시 덮어쓰지 않고 경고만 기록한다.
 *
 * CLI 사용:
 *   node scripts/install-safety-floor-settings.mjs [--dry-run]
 *   기본 대상: .claude/settings.json (현재 디렉토리 기준)
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './pokit-project-contract.mjs';

// ── 안전바닥 훅 정의 ─────────────────────────────────────────────────────────

const SAFETY_FLOOR_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        hooks: [
          {
            type: 'command',
            command: 'node scripts/hooks/session-start.mjs',
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: 'node scripts/hooks/require-active-issue-before-mutation.mjs',
          },
        ],
      },
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'node scripts/hooks/require-active-issue-before-mutation.mjs',
          },
        ],
      },
      {
        matcher: 'Task',
        hooks: [
          {
            type: 'command',
            command: 'node scripts/hooks/require-active-issue-before-mutation.mjs',
          },
        ],
      },
    ],
  },
};

// ── 순수 병합 함수 ────────────────────────────────────────────────────────────

/**
 * 기존 settings와 안전바닥 settings를 비파괴 병합한다.
 *
 * 규칙:
 * - existingSettings가 null/undefined이면 safetyFloor 그대로 반환.
 * - 있으면 사용자 키 전부 보존.
 * - hooks.*에 안전바닥 항목만 추가 (중복이면 추가 안 함).
 * - 같은 matcher에 다른 command가 있으면 덮어쓰지 않고 warnings에 경고 push.
 *
 * @param {object|null} existingSettings
 * @param {object} safetyFloorSettings
 * @returns {{ merged: object, warnings: string[] }}
 */
export function mergeSafetyFloorSettings(existingSettings, safetyFloorSettings) {
  const warnings = [];

  if (existingSettings == null) {
    return { merged: structuredClone(safetyFloorSettings), warnings };
  }

  // 사용자 설정 깊은 복사 (원본 불변 유지)
  const merged = structuredClone(existingSettings);

  const floorHooksByEvent = safetyFloorSettings?.hooks ?? {};
  if (Object.keys(floorHooksByEvent).length === 0) {
    return { merged, warnings };
  }

  // merged.hooks 확보 — 사용자가 hooks를 비-객체로 둔 경우는 구조 충돌 → 경고 후 보존(덮지 않음)
  if (merged.hooks === undefined || merged.hooks === null) {
    merged.hooks = {};
  } else if (typeof merged.hooks !== 'object' || Array.isArray(merged.hooks)) {
    warnings.push(
      '기존 settings.hooks가 객체가 아니어서 안전바닥 훅을 자동 추가하지 못했습니다(기존 값 보존). 수동으로 PreToolUse 훅을 추가해 주세요.',
    );
    return { merged, warnings };
  }
  for (const [eventName, floorHooks] of Object.entries(floorHooksByEvent)) {
    if (!Array.isArray(floorHooks)) {
      warnings.push(`안전바닥 settings.hooks.${eventName}가 배열이 아니어서 건너뜁니다.`);
      continue;
    }
    if (merged.hooks[eventName] === undefined || merged.hooks[eventName] === null) {
      merged.hooks[eventName] = [];
    } else if (!Array.isArray(merged.hooks[eventName])) {
      warnings.push(
        `기존 settings.hooks.${eventName}가 배열이 아니어서 안전바닥 훅을 자동 추가하지 못했습니다(기존 값 보존). 수동 확인이 필요합니다.`,
      );
      continue;
    }

    for (const floorEntry of floorHooks) {
      const floorMatcher = floorEntry.matcher;
      const floorCommand = floorEntry.hooks?.[0]?.command;

      // 동일 matcher 기존 항목 탐색. SessionStart처럼 matcher가 없는 훅은 command로 dedupe.
      const existing = merged.hooks[eventName].find((e) => e.matcher === floorMatcher);

      if (!existing) {
        merged.hooks[eventName].push(structuredClone(floorEntry));
        continue;
      }

      // 있음 → command 중복 확인 (idempotent dedupe)
      const existingCommands = (existing.hooks ?? []).map((h) => h.command);
      if (existingCommands.includes(floorCommand)) {
        // 중복 → 추가 안 함 (재실행 idempotent)
        continue;
      }

      // 같은 matcher에 다른 command → 사용자 항목 보존 + 안전바닥 항목 append
      // (배열 항목이 있다는 것만으로는 충돌이 아님 — 배열은 비파괴 append가 올바른 의미)
      existing.hooks = existing.hooks ?? [];
      for (const floorHook of (floorEntry.hooks ?? [])) {
        if (!existingCommands.includes(floorHook.command)) {
          existing.hooks.push(structuredClone(floorHook));
        }
      }
    }
  }

  return { merged, warnings };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isDryRun = args['dry-run'] === true;
  const root = process.cwd();
  const settingsPath = path.join(root, '.claude', 'settings.json');

  let existing = null;
  try {
    const text = await readFile(settingsPath, 'utf8');
    existing = JSON.parse(text);
    console.log(`기존 설정 파일 발견: ${settingsPath}`);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.log(`설정 파일 없음 — 새로 생성합니다: ${settingsPath}`);
    } else {
      console.error(`설정 파일 읽기 실패: ${err.message}`);
      process.exit(1);
    }
  }

  const { merged, warnings } = mergeSafetyFloorSettings(existing, SAFETY_FLOOR_SETTINGS);

  for (const warn of warnings) {
    console.warn(warn);
  }

  if (isDryRun) {
    console.log('[dry-run] 병합 결과 (파일에 쓰지 않음):');
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  await writeFile(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`안전바닥 설정이 적용됐습니다: ${settingsPath}`);
  if (warnings.length > 0) {
    console.log(`경고 ${warnings.length}건 — 위 내용을 확인해 주세요.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
