#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSessionCloseCard } from './lib/lifecycle-card-renderer.mjs';
import { walk } from './lib/fs-walk.mjs';
import { runPreflight } from './pokit-runner.mjs';

const DEFAULT_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'clean_start', input: '포킷 시작' }),
  Object.freeze({ id: 'diluted_start', input: '잡담 좀 하다가, 포킷 시작 해줘' }),
  Object.freeze({ id: 'session_close', input: '오늘은 여기서 종료하자' }),
  Object.freeze({ id: 'mixed_dispatch', input: '음 그리고 /pokit dispatch POK-048 해봐' }),
  Object.freeze({ id: 'ordinary_chat', input: '오늘 점심 뭐 먹지' }),
]);

export function classifyDryRunConversation(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  const runnerCommand = extractRunnerCommand(text);

  if (runnerCommand) {
    return {
      intent: 'runner_command',
      extractedCommand: runnerCommand,
      shouldRunPreflight: true,
    };
  }

  if (/(^|[\s,.;!?])(?:포킷\s*시작|POKit\s*시작)(?:$|[\s,.;!?]|해줘|하자)/iu.test(text)) {
    return {
      intent: 'startup',
      extractedCommand: '포킷 시작',
      shouldRunPreflight: true,
    };
  }

  if (/(종료|마무리|끝내|세션\s*종료|닫아)/u.test(text)) {
    return {
      intent: 'session_close',
      extractedCommand: null,
      shouldRunPreflight: false,
    };
  }

  return {
    intent: 'ordinary_conversation',
    extractedCommand: null,
    shouldRunPreflight: false,
  };
}

export async function runSessionDryRun({ root = process.cwd(), scenarios = DEFAULT_SCENARIOS } = {}) {
  const before = await snapshotAiOs(root);
  const startup = await runPreflight({ root, phrase: '포킷 시작' });
  const results = [];

  for (const scenario of scenarios) {
    const classification = classifyDryRunConversation(scenario.input);
    const base = {
      id: scenario.id,
      input: scenario.input,
      intent: classification.intent,
      extractedCommand: classification.extractedCommand,
      mutatesState: false,
    };

    if (classification.shouldRunPreflight) {
      results.push({
        ...base,
        runner: compactPreflight(await runPreflight({ root, phrase: classification.extractedCommand })),
        closeCard: null,
      });
      continue;
    }

    if (classification.intent === 'session_close') {
      const closeCard = buildSessionCloseCardFields(startup);
      results.push({
        ...base,
        runner: null,
        closeCard,
        renderedCloseCard: renderSessionCloseCard({ closeCard }),
      });
      continue;
    }

    results.push({
      ...base,
      runner: null,
      closeCard: null,
    });
  }

  const after = await snapshotAiOs(root);

  return {
    status: startup.status,
    activeIssue: startup.activeIssue,
    issuePath: startup.issuePath,
    nonMutating: JSON.stringify(after) === JSON.stringify(before),
    scenarios: results,
  };
}

function compactPreflight(result) {
  return {
    status: result.status,
    phraseMatched: result.phraseMatched,
    command: result.command,
    activeIssue: result.activeIssue,
    issuePath: result.issuePath,
    runnerAssignment: result.runnerAssignment,
    lifecycleCard: result.lifecycleCard,
    renderedLifecycleCard: result.renderedLifecycleCard,
    nextAction: result.nextAction,
  };
}

export function buildSessionCloseCardFields(preflightResult) {
  return {
    card_type: 'session_close',
    title: '🧭 POKit2 세션 종료',
    timestamp_format: 'YYYY-MM-DD HH:mm KST',
    display_only: true,
    approval_required: false,
    fields: {
      close: {
        issue: preflightResult.activeIssue,
        state: preflightResult.lifecycleCard?.fields?.current?.state ?? preflightResult.status,
      },
      handoff: {
        next: preflightResult.nextAction,
        start: '포킷 시작',
      },
    },
    boundaries: [
      'session close summary does not mark gate pass by itself',
      'next session must restore current.md and handoff before acting',
    ],
  };
}

function extractRunnerCommand(text) {
  const dispatchOrGate = text.match(/\/pokit\s+(dispatch|gate)\s+POK-\d{3}/iu);
  if (dispatchOrGate) return dispatchOrGate[0].replace(/\s+/g, ' ');

  const add = text.match(/\/pokit\s+add(?:\s+[^.!?\n]*)?/iu);
  if (add) return add[0].trim().replace(/\s+/g, ' ');

  return null;
}

async function snapshotAiOs(root) {
  const result = {};
  await walk(path.join(root, '.ai-os'), '.ai-os', result);
  return result;
}


const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const result = await runSessionDryRun({ root: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'fail' || !result.nonMutating ? 1 : 0;
}
