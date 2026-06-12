#!/usr/bin/env node
import { appendSkillExecutionCheckpointReceipt } from './lib/event-log.mjs';
import { detectProvider } from './lib/hook-emit.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-/g, '_');
    args[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return args;
}

export async function runSkillCheckpointCli({ root = process.cwd(), argv = process.argv.slice(2) } = {}) {
  const args = parseArgs(argv);
  const issueId = args.issue;
  const selectedSkill = args.selected_skill ?? 'pokit.issue';
  const step = args.step;
  const summary = args.summary ?? '';

  if (!/^POK-\d{3}$/.test(issueId ?? '')) {
    throw new Error('--issue must be POK-###');
  }
  if (typeof step !== 'string' || step.trim().length === 0) {
    throw new Error('--step is required');
  }
  // POK-229 defect ②: runner-owned steps (pre_runner, post_runner_plan) are emitted
  // by pokit-runner.mjs (runPreflight), which calls appendSkillExecutionCheckpointReceipt
  // DIRECTLY with the full validated payload. This CLI must refuse them so the runner
  // stays the only emitter — preventing an incomplete-payload bypass of runner validation
  // (anti-self-certification, POK-228/234). The guard lives here in the CLI, NOT in the
  // shared library, so the runner's legitimate emission is untouched.
  const RUNNER_OWNED_STEPS = new Set(['pre_runner', 'post_runner_plan']);
  if (RUNNER_OWNED_STEPS.has(step)) {
    throw new Error(`--step ${step} is runner-owned and must be emitted by pokit-runner.mjs, not this checkpoint CLI.`);
  }

  const receipt = await appendSkillExecutionCheckpointReceipt(root, {
    issueId,
    selectedSkill,
    step,
    provider: detectProvider(),
    payload: summary ? { summary } : {},
  });
  if (!receipt) throw new Error(`skill_execution_checkpoint was not recorded for ${issueId}`);
  return receipt;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const receipt = await runSkillCheckpointCli();
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
