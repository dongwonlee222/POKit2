#!/usr/bin/env node
import { readTaskSession, resolveSessionRole } from './lib/worktree-sessions.mjs';
import { decidePolicyAction } from './lib/push-policy.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function actionForHook(hookName) {
  if (hookName === 'pre-push') return 'push';
  return 'commit';
}

function mapRoleToPolicyActor(role) {
  if (role === 'main_session') return 'project_main_session';
  return role;
}

async function resolveActor(root, explicitActor) {
  if (explicitActor) return explicitActor;
  const sessionId = process.env.POKIT_SESSION_ID;
  if (sessionId) {
    try {
      const session = await readTaskSession(root, sessionId);
      return mapRoleToPolicyActor(session.role);
    } catch {
      // Fall through to worktree role detection.
    }
  }
  try {
    const role = await resolveSessionRole(root);
    return mapRoleToPolicyActor(role.role);
  } catch {
    return 'project_main_session';
  }
}

export async function runGitPolicyHook({
  argv = process.argv.slice(2),
  root = process.cwd(),
  stderr = process.stderr,
} = {}) {
  const args = parseArgs(argv);
  const hookName = args._[0] ?? 'pre-commit';
  const action = actionForHook(hookName);
  const actor = await resolveActor(root, args.actor);
  const decision = decidePolicyAction({
    actor,
    action,
    surface: `git ${action}`,
    pushPolicy: args['push-policy'],
  });

  if (!decision.allowed) {
    stderr.write([
      `POKit advisory: ${decision.actor} denied ${decision.action} on ${decision.surface}.`,
      `reason: ${decision.reason}`,
      `next_action: ${decision.next_action}`,
      'local git hooks are advisory; authoritative protection belongs to server-side rulesets or role-scoped credentials.',
      '',
    ].join('\n'));
  }
  return { ok: true, decision };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runGitPolicyHook();
}
