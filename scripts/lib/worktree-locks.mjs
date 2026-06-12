import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LOCK_SCHEMA_VERSION = '0.1.0';

function nowIso() {
  return new Date().toISOString();
}

function jsonWithNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lockFileName(kind, resource) {
  return `${kind}-${slug(resource)}.json`;
}

function resourceFor(kind, opts) {
  if (kind === 'issue') return String(opts.issueId ?? opts.resource ?? '').trim();
  return String(opts.filePath ?? opts.resource ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function gitCommonDir(root) {
  const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  const raw = result.stdout.trim();
  if (!raw) return null;
  return path.resolve(root, raw);
}

function gitDir(root) {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  const raw = result.stdout.trim();
  if (!raw) return null;
  return path.resolve(root, raw);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGitAdministrativeLocks(root, {
  retryDelaysMs = [200, 400, 800],
} = {}) {
  const dirs = [gitDir(root), gitCommonDir(root)].filter(Boolean);
  const lockPaths = Array.from(new Set(dirs.flatMap((dir) => [
    path.join(dir, 'config.lock'),
    path.join(dir, 'index.lock'),
  ])));

  let attempts = 1;
  for (const delay of [0, ...retryDelaysMs]) {
    if (delay > 0) {
      await sleep(delay);
      attempts += 1;
    }
    const present = [];
    for (const lockPath of lockPaths) {
      if (await exists(lockPath)) present.push(lockPath);
    }
    if (present.length === 0) {
      return { cleared: true, attempts, lock_paths: lockPaths };
    }
  }
  return { cleared: false, attempts, lock_paths: lockPaths };
}

export async function resolveLockRoot(root) {
  const commonDir = gitCommonDir(root);
  if (commonDir) {
    const commonParent = path.dirname(commonDir);
    return {
      mode: 'git-common-worktree-local',
      path: path.join(commonParent, '.pokit/locks'),
    };
  }
  return {
    mode: 'local-only',
    path: path.join(root, '.pokit/locks'),
  };
}

async function lockPathFor(root, kind, resource) {
  const lockRoot = await resolveLockRoot(root);
  return {
    lockRoot,
    lockPath: path.join(lockRoot.path, lockFileName(kind, resource)),
  };
}

function conflictMessage(existing) {
  if (existing.kind === 'issue') {
    return `Issue ${existing.resource} is already locked by ${existing.holder}; finish, release, or takeover explicitly.`;
  }
  return `State write ${existing.resource} is already guarded by ${existing.holder}; finish, release, or takeover explicitly.`;
}

async function acquireLock(root, {
  kind,
  resource,
  holder,
  reason,
  force = false,
  shortLived = false,
  issueId = null,
  project = 'pokit',
}) {
  if (!resource) throw new Error('lock resource is required');
  if (!holder) throw new Error('lock holder is required');
  if (!reason) throw new Error('lock reason is required');

  const { lockRoot, lockPath } = await lockPathFor(root, kind, resource);
  const gitLocks = await waitForGitAdministrativeLocks(root);
  if (!gitLocks.cleared) {
    return {
      acquired: false,
      conflict: true,
      lock: null,
      lockPath,
      lockRoot,
      message: 'git administrative lock is still present; retry after the concurrent git operation finishes.',
    };
  }
  await mkdir(lockRoot.path, { recursive: true });

  let existing = null;
  try {
    existing = await readJson(lockPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }

  if (existing) {
    if (existing.holder === holder && !force) {
      return {
        acquired: true,
        idempotent: true,
        lock: existing,
        lockPath,
        lockRoot,
        message: `${kind} ${resource} already held by ${holder}`,
      };
    }
    if (!force) {
      return {
        acquired: false,
        conflict: true,
        lock: existing,
        lockPath,
        lockRoot,
        message: conflictMessage(existing),
      };
    }
  }

  const lock = {
    schema_version: LOCK_SCHEMA_VERSION,
    kind,
    resource,
    project,
    issue_id: issueId,
    holder,
    reason,
    created_at: nowIso(),
    lifecycle: shortLived ? 'short_lived' : 'long_lived',
  };
  if (existing && force) {
    lock.takeover_from = existing.holder;
    lock.takeover_reason = reason;
    lock.takeover_at = nowIso();
  }

  try {
    await writeFile(lockPath, jsonWithNewline(lock), { encoding: 'utf8', flag: existing && force ? 'w' : 'wx' });
  } catch (err) {
    if (err?.code !== 'EEXIST') throw err;
    let concurrent = null;
    for (const delay of [50, 100, 200]) {
      await sleep(delay);
      try {
        concurrent = await readJson(lockPath);
        break;
      } catch (readErr) {
        if (readErr?.code !== 'ENOENT') throw readErr;
      }
    }
    if (!concurrent) {
      return acquireLock(root, {
        kind,
        resource,
        holder,
        reason,
        force,
        shortLived,
        issueId,
        project,
      });
    }
    return {
      acquired: false,
      conflict: true,
      lock: concurrent,
      lockPath,
      lockRoot,
      message: conflictMessage(concurrent),
    };
  }
  return {
    acquired: true,
    takeover: Boolean(existing && force),
    lock,
    lockPath,
    lockRoot,
    message: `acquired ${kind} ${resource}`,
  };
}

export async function acquireIssueLock(root, opts) {
  const resource = resourceFor('issue', opts);
  return acquireLock(root, {
    ...opts,
    kind: 'issue',
    resource,
    issueId: resource,
    shortLived: false,
  });
}

export async function acquireStateWriteGuard(root, opts) {
  const resource = resourceFor('state_write_guard', opts);
  return acquireLock(root, {
    ...opts,
    kind: 'state_write_guard',
    resource,
    shortLived: true,
  });
}

export async function withStateWriteGuard(root, opts, fn) {
  const guard = await acquireStateWriteGuard(root, opts);
  if (!guard.acquired) throw new Error(guard.message);
  try {
    return await fn(guard);
  } finally {
    await releaseLock(root, {
      kind: 'state_write_guard',
      resource: guard.lock.resource,
      holder: opts.holder,
    });
  }
}

export async function releaseLock(root, { kind, resource, holder, force = false }) {
  if (!kind) throw new Error('lock kind is required');
  if (!resource) throw new Error('lock resource is required');
  if (!holder) throw new Error('lock holder is required');

  const normalizedResource = kind === 'state_write_guard'
    ? resourceFor(kind, { resource })
    : String(resource).trim();
  const { lockRoot, lockPath } = await lockPathFor(root, kind, normalizedResource);
  const existing = await readJson(lockPath);

  if (existing.holder !== holder && !force) {
    throw new Error(`${kind} ${normalizedResource} is held by ${existing.holder}`);
  }

  await rm(lockPath, { force: true });
  return {
    released: true,
    lock: existing,
    lockPath,
    lockRoot,
    message: `released ${kind} ${normalizedResource}`,
  };
}

export async function listLocks(root) {
  const lockRoot = await resolveLockRoot(root);
  let entries;
  try {
    entries = await readdir(lockRoot.path, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  const locks = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const lockPath = path.join(lockRoot.path, entry.name);
    locks.push({ ...(await readJson(lockPath)), lock_path: lockPath });
  }
  return locks;
}
