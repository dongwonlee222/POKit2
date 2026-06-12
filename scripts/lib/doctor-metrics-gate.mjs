// POK-311 — extracted from scripts/pokit-doctor.mjs
// Owns async metrics-evidence and gate-evidence git-tracking checks.
// IO-dependent (filesystem + git subprocess). Caller injects { pass, fail }
// from doctor module scope. listIssueFiles imported from shared lib.

import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

import { listIssueFiles } from './issue-paths.mjs';
import { parseFrontmatter, resolveIssueSprint } from './issue-frontmatter.mjs';

// POK-328 — exemption ledger for the gate-pass-CLI-bypass era. These issues were
// gate-passed via manual state edits + commit (the runner gate-pass chokepoint
// never ran), so no metrics.json exists. Recorded honestly as "uncollected at the
// time" instead of back-filling fake-timestamp metrics. Do NOT add new entries
// without a PO-approved reason — the repaired check exists to make this list stop growing.
export const METRICS_EVIDENCE_EXEMPTIONS = Object.freeze({
  'POK-312': 'v0.16.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
  'POK-313': 'v0.16.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
  'POK-316': 'v0.16.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
  'POK-320': 'v0.17.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
  'POK-321': 'v0.17.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
  'POK-322': 'v0.17.0 — gate-pass 명령 우회 (수동 상태 편집 + 커밋). POK-325 조사 박제.',
});

// ── Private helpers (local copies; doctor originals retained) ─────────────────

async function readOptional(root, filePath) {
  try {
    return await readFile(path.join(root, filePath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function exists(root, filePath) {
  try {
    await access(path.join(root, filePath));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

// parseFrontmatter imported from ./issue-frontmatter.mjs (POK-339)

async function findIssueMetricsPath(projectRoot, issueId) {
  const runsRoot = path.join(projectRoot, '.ai-os/runs');
  let dateEntries;
  try {
    dateEntries = await readdir(runsRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const dateEntry of dateEntries) {
    if (!dateEntry.isDirectory()) continue;
    const relPath = `.ai-os/runs/${dateEntry.name}/${issueId}/metrics.json`;
    if (await exists(projectRoot, relPath)) return relPath;
  }
  return null;
}

async function isGitWorkTree(projectRoot) {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const { stdout } = await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectRoot });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

// ── Private helper (moved from doctor; no longer needed there) ────────────────

async function isGitTracked(projectRoot, filePath) {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    await exec('git', ['ls-files', '--error-unmatch', '--', filePath], { cwd: projectRoot });
    return true;
  } catch {
    return false;
  }
}

function isSprintV010OrLater(sprint) {
  if (!sprint || typeof sprint !== 'string') return false;
  const match = sprint.match(/^v(\d+)\.(\d+)/);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return major > 0 || minor >= 10;
}

function isSprintV015OrLater(sprint) {
  const match = String(sprint ?? '').match(/^v0\.(\d+)\.0$/);
  if (!match) return false;
  return Number(match[1]) >= 15;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function checkV010MetricsEvidence(projectRoot, items, { pass, fail }) {
  const { dir, files: issueFiles } = await listIssueFiles(projectRoot);
  if (issueFiles.length === 0) return;

  for (const name of issueFiles) {
    const issueId = name.replace('.md', '');
    const filePath = `${dir}/${name}`;
    const text = await readOptional(projectRoot, filePath);
    if (text === null) continue;

    const frontmatter = parseFrontmatter(text);
    if (frontmatter.gate_state !== 'gate_passed') continue;
    // POK-328 — sprint field renamed to sprint_candidate; reading only `sprint:`
    // silently skipped every modern card (dead check). Shared accessor is the fix.
    const sprint = resolveIssueSprint(frontmatter);
    if (!isSprintV010OrLater(sprint)) continue;

    const metricsPath = await findIssueMetricsPath(projectRoot, issueId);
    if (!metricsPath) {
      const exemption = METRICS_EVIDENCE_EXEMPTIONS[issueId];
      if (exemption) {
        pass(items, 'v010_metrics_evidence', `projects exemption ${issueId}`,
          `${issueId} metrics 면제 명단 (사유: ${exemption})`);
        continue;
      }
      fail(items, 'v010_metrics_evidence', `.ai-os/runs/*/${issueId}/metrics.json`,
        `${sprint} gate-passed issue ${issueId} has no metrics.json evidence.`,
        `Record .ai-os/runs/YYYY-MM-DD/${issueId}/metrics.json before gate.`
      );
      continue;
    }

    const metricsText = await readOptional(projectRoot, metricsPath);
    try {
      JSON.parse(metricsText);
    } catch {
      fail(items, 'v010_metrics_evidence', metricsPath, 'metrics.json is not valid JSON.', 'Write valid metrics JSON before gate.');
      continue;
    }

    pass(items, 'v010_metrics_evidence', metricsPath, `${issueId} has metrics.json evidence.`);
  }
}

export async function checkGateEvidenceGitTracking(projectRoot, items, { pass, fail }) {
  if (!await isGitWorkTree(projectRoot)) return;

  const { dir, files: issueFiles } = await listIssueFiles(projectRoot);
  if (issueFiles.length === 0) return;

  for (const name of issueFiles) {
    const issueId = name.replace('.md', '');
    const filePath = `${dir}/${name}`;
    const text = await readOptional(projectRoot, filePath);
    if (text === null) continue;

    const frontmatter = parseFrontmatter(text);
    if (frontmatter.gate_state !== 'gate_passed') continue;
    if (!isSprintV015OrLater(resolveIssueSprint(frontmatter))) continue;

    const metricsPath = await findIssueMetricsPath(projectRoot, issueId);
    if (!metricsPath) continue;

    if (await isGitTracked(projectRoot, metricsPath)) {
      pass(items, 'gate_evidence_git_tracking', metricsPath, `${issueId} metrics evidence is tracked by git.`);
    } else {
      fail(items, 'gate_evidence_git_tracking', metricsPath,
        `${issueId} gate evidence exists but is not tracked by git: ${metricsPath}.`,
        `Track the evidence file before gate, or move it out of ignored paths: git add -f ${metricsPath}`
      );
    }
  }
}
