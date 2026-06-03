import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STARTER_ROOT = path.resolve(__dirname, '..');

// Helper: import runDoctor fresh from the scripts directory
async function importRunDoctor() {
  const { runDoctor } = await import(path.join(STARTER_ROOT, 'scripts/pokit-doctor.mjs'));
  return runDoctor;
}

// Helper: get statuses for a specific check name from result.items
function statuses(items, check) {
  return items.filter((item) => item.check === check).map((item) => item.status);
}

// Helper: initialize a minimal git repo with user config
function gitInit(cwd) {
  execFileSync('git', ['init'], { cwd });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd });
}

// Helper: write minimal scaffolding needed by runDoctor
async function writeScaffold(root, { activeIssue = null, nextAction = 'create an issue' } = {}) {
  await mkdir(path.join(root, '.ai-os', 'memory', 'session'), { recursive: true });
  await mkdir(path.join(root, '.ai-os', 'standards'), { recursive: true });
  await mkdir(path.join(root, '.ai-os', 'events'), { recursive: true });

  await writeFile(
    path.join(root, '.ai-os', 'current.md'),
    [
      '---',
      'schema_version: 0.1.0',
      'contract_version: 1.0.0',
      `active_issue: ${activeIssue ?? 'null'}`,
      `next_action: ${nextAction}`,
      'active_project: common',
      '---',
      '',
      '## start_read_order',
      '',
      '1. `AGENTS.md`',
      '2. `.ai-os/current.md`',
      '3. `.ai-os/memory/session/handoff.md`',
      '',
      '## work_read_order',
      '',
      '1. `.ai-os/status-board.md`',
      '2. `.ai-os/failure-index.md`',
      '3. `.ai-os/issue-index.md`',
      '4. `.ai-os/artifact-index.md`',
      '5. `.ai-os/memory-index.md`',
      '6. `.ai-os/standards/communication.md`',
      '7. `.ai-os/standards/visualization.md`',
      '8. `.ai-os/standards/agent-invocation.md`',
      '9. `.ai-os/standards/artifact-standard.md`',
      '10. `.ai-os/standards/writing-style.md`',
      '',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    path.join(root, '.ai-os', 'projects.yaml'),
    [
      'projects:',
      '  - key: common',
      '    name: Common',
      '    namespace: COM',
      '    next_number: 2',
    ].join('\n') + '\n',
    'utf8',
  );
}

// Helper: write an issue card file
async function writeIssueCard(root, { id = 'COM-001', createdAt = '2026-06-01' } = {}) {
  const issueDir = path.join(root, 'projects', 'common', 'issues');
  await mkdir(issueDir, { recursive: true });
  await writeFile(
    path.join(issueDir, `${id}.md`),
    [
      '---',
      'schema_version: 0.1.0',
      `id: ${id}`,
      'namespace: COM',
      'project: common',
      `title: Test issue ${id}`,
      'issue_type: implementation',
      'canonical_state: backlog',
      'gate_state: pending',
      'status: pending',
      `created_at: ${createdAt}`,
      '---',
      '',
      `# ${id} Test issue`,
      '',
    ].join('\n'),
    'utf8',
  );
}

// Helper: write an event-log entry for issue_authored
async function writeAuthoringReceipt(root, issueId) {
  const receipt = JSON.stringify({
    event_type: 'issue_authored',
    event_name: 'issue_authored',
    issue_id: issueId,
    created_at: '2026-06-01',
    emitted_at: new Date().toISOString(),
    provider: 'starter_cli',
  });
  await mkdir(path.join(root, '.ai-os', 'events'), { recursive: true });
  await writeFile(path.join(root, '.ai-os', 'events', 'event-log.jsonl'), `${receipt}\n`, 'utf8');
}

// ── T1: CASE 1 — dirty tree + active_issue=null → durable_binding FAIL ────────
test('T1: dirty tracked file with active_issue=null → durable_binding fail', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t1-'));
  try {
    gitInit(root);
    await writeScaffold(root, { activeIssue: null });

    // Initial commit with a tokened subject so CASE-2 won't fire
    await writeFile(path.join(root, 'init.txt'), 'init\n', 'utf8');
    execFileSync('git', ['add', 'init.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'feat(COM-001): initial commit'], { cwd: root });

    // Now modify a tracked file to create dirty state (CASE 1)
    await writeFile(path.join(root, 'init.txt'), 'modified\n', 'utf8');

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      bindingStatuses.includes('fail'),
      `Expected durable_binding fail, got: ${JSON.stringify(bindingStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── T2: CASE 2 — issue exists, HEAD commit has no token → durable_binding FAIL ─
test('T2: HEAD commit with no issue token when issues exist → durable_binding fail', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t2-'));
  try {
    gitInit(root);
    await writeScaffold(root, { activeIssue: 'COM-001' });
    await writeIssueCard(root, { id: 'COM-001', createdAt: '2026-06-01' });
    await writeAuthoringReceipt(root, 'COM-001');

    // Commit with a subject that has NO issue token
    await writeFile(path.join(root, 'init.txt'), 'init\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'update files'], { cwd: root });

    // Clean tree (no dirty files)

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      bindingStatuses.includes('fail'),
      `Expected durable_binding fail (no token in HEAD), got: ${JSON.stringify(bindingStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── T3: AC3 — issue with created_at>=cutoff, no receipt → issue_authoring_evidence FAIL
test('T3: issue created_at>=cutoff with no authoring receipt → issue_authoring_evidence fail', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t3-'));
  try {
    gitInit(root);
    await writeScaffold(root, { activeIssue: 'COM-001' });
    await writeIssueCard(root, { id: 'COM-001', createdAt: '2026-06-01' });
    // NO authoring receipt written

    // Commit with a token so CASE-2 won't fire
    await writeFile(path.join(root, 'init.txt'), 'init\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'feat(COM-001): initial commit'], { cwd: root });

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const evidenceStatuses = statuses(result.items, 'issue_authoring_evidence');
    assert.ok(
      evidenceStatuses.includes('fail'),
      `Expected issue_authoring_evidence fail, got: ${JSON.stringify(evidenceStatuses)}`,
    );

    // durable_binding should NOT fail (clean tree + tokened HEAD)
    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      !bindingStatuses.includes('fail'),
      `durable_binding should not fail, got: ${JSON.stringify(bindingStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── T4: all-bound — clean tree, tokened commit, receipt present → all pass ─────
test('T4: clean tree, tokened commit, authoring receipt → both checks pass', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t4-'));
  try {
    gitInit(root);
    await writeScaffold(root, { activeIssue: 'COM-001' });
    await writeIssueCard(root, { id: 'COM-001', createdAt: '2026-06-01' });
    await writeAuthoringReceipt(root, 'COM-001');

    // Commit with a token
    await writeFile(path.join(root, 'init.txt'), 'init\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'feat(COM-001): init'], { cwd: root });

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      !bindingStatuses.includes('fail'),
      `durable_binding should not fail, got: ${JSON.stringify(bindingStatuses)}`,
    );

    const evidenceStatuses = statuses(result.items, 'issue_authoring_evidence');
    assert.ok(
      !evidenceStatuses.includes('fail'),
      `issue_authoring_evidence should not fail, got: ${JSON.stringify(evidenceStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── T5: clean-tree bootstrap — zero issues, active_issue=null, tokenless commit → pass
test('T5: clean tree, zero issues, active_issue=null → durable_binding pass (no false positive)', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t5-'));
  try {
    gitInit(root);
    await writeScaffold(root, { activeIssue: null });

    // Single tokenless initial commit
    await writeFile(path.join(root, 'init.txt'), 'init\n', 'utf8');
    execFileSync('git', ['add', 'init.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: root });

    // No issues created, no dirty files

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      !bindingStatuses.includes('fail'),
      `durable_binding should not fail for bootstrap repo, got: ${JSON.stringify(bindingStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── T6: non-git dir → durable_binding graceful pass ──────────────────────────
test('T6: non-git directory → durable_binding graceful pass', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pokit-binding-t6-'));
  try {
    // Do NOT git init — this is intentionally not a git repo
    await writeScaffold(root, { activeIssue: null });

    const runDoctor = await importRunDoctor();
    const result = await runDoctor({ root });

    const bindingStatuses = statuses(result.items, 'durable_binding');
    assert.ok(
      !bindingStatuses.includes('fail'),
      `durable_binding should gracefully pass for non-git dir, got: ${JSON.stringify(bindingStatuses)}`,
    );
    assert.ok(
      bindingStatuses.includes('pass'),
      `durable_binding should emit a pass for non-git dir, got: ${JSON.stringify(bindingStatuses)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
