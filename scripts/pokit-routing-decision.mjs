#!/usr/bin/env node
import { appendRoutingDecisionReceipt } from './lib/event-log.mjs';

const REQUEST_CLASSES = new Set([
  'issue_authoring',
  'issue_modification',
  'issue_grooming',
  'definition_change',
  'readiness_transition',
  'issue_execution',
  'project_creation',
]);

const DECISION_SOURCES = new Set([
  'llm_selected_skill',
  'manual_fallback',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args[key] = value;
  }
  return args;
}

function detectProvider() {
  const agent = (process.env.POKIT_AGENT_PROVIDER || process.env.CLAUDECODE || process.env.CODEX || '').toLowerCase();
  if (agent.includes('claude')) return 'claude_code';
  if (agent.includes('codex')) return 'codex';
  return 'unknown';
}

function usage() {
  return [
    'Usage:',
    '  node scripts/pokit-routing-decision.mjs --issue POK-209 --selected-skill pokit.issue --request-class issue_execution --decision-reason "active issue execution approved"',
    '',
    'Required:',
    '  --issue POK-###',
    '  --selected-skill pokit.backlog|pokit.issue|pokit.project',
    '  --request-class issue_authoring|issue_modification|issue_grooming|definition_change|readiness_transition|issue_execution|project_creation',
    '  --decision-reason <short reason>',
  ].join('\n');
}

export async function main({ root = process.cwd(), argv = process.argv.slice(2), stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = parseArgs(argv);
  const issueId = args.issue;
  const selectedSkill = args['selected-skill'];
  const requestClass = args['request-class'];
  const decisionReason = args['decision-reason'];
  const decisionSource = args['decision-source'] ?? 'llm_selected_skill';

  if (!/^POK-\d{3}$/.test(issueId ?? '')) {
    stderr.write(`Invalid --issue.\n${usage()}\n`);
    return 2;
  }
  if (!['pokit.backlog', 'pokit.issue', 'pokit.project'].includes(selectedSkill)) {
    stderr.write(`Invalid --selected-skill.\n${usage()}\n`);
    return 2;
  }
  if (!REQUEST_CLASSES.has(requestClass)) {
    stderr.write(`Invalid --request-class.\n${usage()}\n`);
    return 2;
  }
  if (!DECISION_SOURCES.has(decisionSource)) {
    stderr.write(`Invalid --decision-source.\n${usage()}\n`);
    return 2;
  }
  if (typeof decisionReason !== 'string' || decisionReason.trim().length === 0) {
    stderr.write(`Missing --decision-reason.\n${usage()}\n`);
    return 2;
  }

  const receipt = await appendRoutingDecisionReceipt(root, {
    issueId,
    selectedSkill,
    requestClass,
    decisionReason,
    decisionSource,
    provider: detectProvider(),
  });
  if (!receipt) {
    stderr.write('Failed to append routing_decision receipt.\n');
    return 1;
  }

  stdout.write(`${JSON.stringify(receipt)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
