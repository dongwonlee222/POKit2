#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { appendIssuePreflightPassReceipt } from './lib/event-log.mjs';
import { runSubIssueChecks } from './lib/sub-issue-check.mjs';
import { parseSubIssues } from './lib/sub-issue-schema.mjs';
import { parseFrontmatter } from './lib/issue-frontmatter.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

// parseFrontmatter imported from ./lib/issue-frontmatter.mjs (POK-339)

async function readText(root, relPath) {
  return readFile(path.join(root, relPath), 'utf8');
}

async function exists(root, relPath) {
  try {
    await stat(path.join(root, relPath));
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

async function resolveIssuePath(root, issueId) {
  const candidates = [
    `projects/pokit/issues/${issueId}.md`,
    `.ai-os/${issueId}.md`,
  ];
  for (const candidate of candidates) {
    if (await exists(root, candidate)) return candidate;
  }
  return candidates[0];
}

async function resolveActiveIssue(root, explicitIssue) {
  if (explicitIssue) return explicitIssue;
  const currentText = await readText(root, '.ai-os/current.md');
  const current = parseFrontmatter(currentText);
  return current.active_issue ?? null;
}

function statusIsExecutable(status) {
  return ['accepted', 'pending', 'in_progress'].includes(status);
}

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRe = new RegExp(`^##\\s+${escaped}\\s*$`, 'im');
  const start = startRe.exec(content);
  if (!start) return '';

  const sectionStart = start.index + start[0].length;
  const rest = content.slice(sectionStart);
  const nextHeading = rest.search(/\n##\s+/);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

function countAcceptanceCriteria(content) {
  const section = extractSection(content, 'Acceptance Criteria');
  if (!section) return 0;
  return section.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^[-*]\s+\[[ xX]\]\s+AC\d+\b/.test(trimmed)) return true;
    if (/^[-*]\s+AC\d+\b/.test(trimmed)) return true;
    if (/^\d+[.)]\s+/.test(trimmed)) return true;
    return false;
  }).length;
}

function hasWorkerTasksOptOut(frontmatter) {
  return frontmatter.worker_tasks === 'not_required'
    && typeof frontmatter.worker_tasks_skip_reason === 'string'
    && frontmatter.worker_tasks_skip_reason.trim().length > 0;
}

function targetedDecompositionFailures({ frontmatter, content, issuePath }) {
  const acCount = countAcceptanceCriteria(content);
  if (acCount < 5) return [];
  if (hasWorkerTasksOptOut(frontmatter)) return [];
  try {
    if (parseSubIssues(content).length > 0) return [];
  } catch {
    return [];
  }

  return [{
    check: 'targeted_worker_tasks_required',
    path: issuePath,
    message: `AC count ${acCount} >= 5 requires a ## Worker Tasks YAML block before worker dispatch.`,
    next_action: 'Add ## Worker Tasks with fenced yaml entries containing id, title, worker_type, allowed_paths, and expected_output; or add worker_tasks: not_required plus worker_tasks_skip_reason.',
  }];
}

function preflightFailures(results) {
  return results.filter((result) => {
    if (result.status === 'fail') return true;
    return result.check === 'sub_issue_required_fields' && result.status === 'warning';
  });
}

export async function runIssuePreflight({
  root,
  issueId,
  writeReceipt = true,
  provider = 'unknown',
} = {}) {
  const activeIssue = await resolveActiveIssue(root, issueId);
  if (!/^POK-\d{3}$/.test(activeIssue ?? '')) {
    return {
      status: 'fail',
      issue_id: activeIssue,
      failures: [{
        check: 'active_issue',
        message: 'active_issue is missing or invalid.',
        next_action: 'Set .ai-os/current.md active_issue or pass --issue POK-XXX.',
      }],
      results: [],
    };
  }

  const issuePath = await resolveIssuePath(root, activeIssue);
  const issueText = await readText(root, issuePath);
  const issue = parseFrontmatter(issueText);
  const readiness = issue.definition_readiness;
  const issueStatus = issue.status ?? issue.gate_state;

  const earlyFailures = [];
  if (readiness !== 'pass') {
    earlyFailures.push({
      check: 'definition_readiness',
      path: issuePath,
      message: `definition_readiness must be pass before /pokit.issue execution (got ${readiness ?? 'missing'}).`,
      next_action: 'Route to /pokit.backlog or /pokit.clarify before execution.',
    });
  }
  if (!statusIsExecutable(issueStatus)) {
    earlyFailures.push({
      check: 'issue_status',
      path: issuePath,
      message: `Issue status must be accepted, pending, or in_progress before execution (got ${issueStatus ?? 'missing'}).`,
      next_action: 'Select an executable issue or update readiness through /pokit.backlog.',
    });
  }

  const issueDir = path.dirname(issuePath);
  const issueFile = path.basename(issuePath);
  const checkResult = await runSubIssueChecks(root, issueDir, [issueFile]);
  const failures = [
    ...earlyFailures,
    ...targetedDecompositionFailures({ frontmatter: issue, content: issueText, issuePath }),
    ...preflightFailures(checkResult.results),
  ];
  const status = failures.length > 0 ? 'fail' : 'pass';

  let receipt = null;
  if (status === 'pass' && writeReceipt) {
    receipt = await appendIssuePreflightPassReceipt(root, {
      issueId: activeIssue,
      provider,
      checks: checkResult.results.map((result) => result.check),
    });
  }

  return {
    status,
    issue_id: activeIssue,
    issue_path: issuePath,
    failures,
    results: checkResult.results,
    receipt,
  };
}

function renderFailures(failures) {
  return failures.map((failure) => {
    const pathPart = failure.path ? `${failure.path}: ` : '';
    const nextPart = failure.next_action ? `\n  next_action: ${failure.next_action}` : '';
    return `[fail] ${failure.check} ${pathPart}${failure.message}${nextPart}`;
  }).join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // 글로벌 설치 토폴로지에서 스크립트 위치는 본체(패키지) — 프로젝트는 cwd 기준.
  const root = args.root ? path.resolve(args.root) : process.cwd();
  const issueId = args.issue ?? null;
  const writeReceipt = args['no-receipt'] !== true;
  const provider = args.provider ?? 'unknown';

  try {
    const result = await runIssuePreflight({ root, issueId, writeReceipt, provider });
    if (result.status !== 'pass') {
      process.stderr.write(`${renderFailures(result.failures)}\n`);
      process.exit(1);
    }
    process.stdout.write(`${JSON.stringify({
      status: result.status,
      issue_id: result.issue_id,
      issue_path: result.issue_path,
      receipt: result.receipt ? {
        event_name: result.receipt.event_name,
        emitted_at: result.receipt.emitted_at,
      } : null,
      checked: result.results.length,
    }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
