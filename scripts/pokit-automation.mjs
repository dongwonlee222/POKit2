#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  disableAutomation,
  previewAutomation,
  recordAutomationRunState,
  registerAutomation,
  runAutomationFirstTrial,
} from './lib/automation.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export async function runCli(argv = process.argv.slice(2), { root = process.cwd() } = {}) {
  const args = parseArgs(argv);
  const command = args._[0];
  const common = {
    root,
    issueId: args.issue ?? args.issueId,
    preset: args.preset,
    input: args.input ?? args._.slice(1).join(' '),
  };

  if (command === 'preview') {
    const result = await previewAutomation(common);
    return { exitCode: 0, output: result.renderedPreviewCard };
  }

  if (command === 'register') {
    const result = await registerAutomation(common);
    return {
      exitCode: 0,
      output: `${result.renderedPreviewCard}\n\n${JSON.stringify({ definition_path: result.definitionPath }, null, 2)}`,
    };
  }

  if (command === 'run') {
    const result = await runAutomationFirstTrial({ root, id: args.id ?? args._[1] });
    return {
      exitCode: 0,
      output: `${result.renderedRunCard}\n\n${JSON.stringify({ receipt_path: result.receiptPath }, null, 2)}`,
    };
  }

  if (command === 'disable') {
    const result = await disableAutomation({ root, id: args.id ?? args._[1] });
    return {
      exitCode: 0,
      output: JSON.stringify({
        status: 'disabled',
        id: result.definition.id,
        definition_path: result.definitionPath,
      }, null, 2),
    };
  }

  if (command === 'state') {
    const result = await recordAutomationRunState({
      root,
      id: args.id ?? args._[1],
      status: args.status,
      eventName: args.eventName,
      runId: args.runId,
      runKey: args.runKey,
      project: args.project,
      scope: args.scope,
      mode: args.mode,
      mutating: parseBoolean(args.mutating, false),
      policyTier: args.policyTier,
      provider: args.provider,
      evidence: {
        preview: args.preview ?? null,
        verification: args.verification ?? null,
        diff: args.diff ?? null,
        fallback: args.fallback ?? null,
      },
      nextAction: args.nextAction,
      details: {
        attemptedRuntime: args.runtime ?? args.attemptedRuntime,
        attemptedWorkerType: args.workerType ?? args.attemptedWorkerType,
        error: args.error,
        retryCount: args.retryCount,
        replacementPath: args.replacementPath,
        residualRisk: args.residualRisk,
        queueMode: args.queueMode,
        replacedRunId: args.replacedRunId,
        attempt: args.attempt,
        maxAttempts: args.maxAttempts,
        waitMs: args.waitMs,
        reason: args.reason,
        previousRunId: args.previousRunId,
        blockedStep: args.blockedStep,
        lockResource: args.lockResource,
        lockHolder: args.lockHolder,
      },
    });
    return {
      exitCode: 0,
      output: `${result.renderedRunCard}\n\n${JSON.stringify({ receipt_path: result.receiptPath }, null, 2)}`,
    };
  }

  return {
    exitCode: 2,
    output: [
      'usage:',
      '  node scripts/pokit-automation.mjs preview --preset state-doctor --issue POK-278',
      '  node scripts/pokit-automation.mjs register --preset state-doctor --issue POK-278',
      '  node scripts/pokit-automation.mjs run --id state-doctor',
      '  node scripts/pokit-automation.mjs state --id state-doctor --status worker-unavailable --runtime codex --worker-type code_worker',
      '  node scripts/pokit-automation.mjs disable --id state-doctor',
    ].join('\n'),
  };
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true) return true;
  if (/^(true|1|yes)$/i.test(String(value))) return true;
  if (/^(false|0|no)$/i.test(String(value))) return false;
  return fallback;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  try {
    const result = await runCli();
    console.log(result.output);
    process.exitCode = result.exitCode;
  } catch (err) {
    console.error(err?.message ?? String(err));
    process.exitCode = 1;
  }
}
