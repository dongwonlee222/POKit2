export const POLICY_ACTORS = new Set([
  'task_session',
  'integration_session',
  'project_main_session',
  'project_overview',
]);

export const POLICY_ACTIONS = new Set([
  'state_write',
  'gate_claim',
  'commit',
  'push',
  'overview_read',
]);

const PUSH_APPROVAL_MODES = new Set(['approved', 'po-confirmed']);

const ALLOWED_ACTIONS = {
  task_session: new Set([]),
  integration_session: new Set(['state_write', 'gate_claim', 'commit']),
  project_main_session: new Set(['state_write', 'gate_claim', 'commit']),
  project_overview: new Set(['overview_read']),
};

function normalizeActor(actor) {
  return String(actor ?? '').trim().replace(/-/g, '_');
}

function normalizeAction(action) {
  return String(action ?? '').trim().replace(/-/g, '_');
}

function deny({ actor, action, surface, reason, nextAction, requiresApproval = false }) {
  return {
    allowed: false,
    actor,
    action,
    surface: String(surface ?? action),
    reason,
    requires_approval: requiresApproval,
    next_action: nextAction,
  };
}

function allow({ actor, action, surface, reason = 'allowed by actor policy' }) {
  return {
    allowed: true,
    actor,
    action,
    surface: String(surface ?? action),
    reason,
    requires_approval: false,
    next_action: 'Proceed through the guarded command surface.',
  };
}

export function decidePolicyAction({
  actor,
  action,
  surface = null,
  pushPolicy = 'po-confirm',
} = {}) {
  const normalizedActor = normalizeActor(actor);
  const normalizedAction = normalizeAction(action);
  const protectedSurface = String(surface ?? normalizedAction);

  if (!POLICY_ACTORS.has(normalizedActor)) {
    return deny({
      actor: normalizedActor || String(actor ?? ''),
      action: normalizedAction,
      surface: protectedSurface,
      reason: `unknown actor: ${actor}`,
      nextAction: 'Choose task_session, integration_session, project_main_session, or project_overview.',
    });
  }
  if (!POLICY_ACTIONS.has(normalizedAction)) {
    return deny({
      actor: normalizedActor,
      action: normalizedAction || String(action ?? ''),
      surface: protectedSurface,
      reason: `unknown action: ${action}`,
      nextAction: 'Choose state_write, gate_claim, commit, push, or overview_read.',
    });
  }

  if (normalizedActor === 'task_session' && ['state_write', 'gate_claim', 'commit', 'push'].includes(normalizedAction)) {
    return deny({
      actor: normalizedActor,
      action: normalizedAction,
      surface: protectedSurface,
      reason: `task_session cannot perform ${normalizedAction} on ${protectedSurface}`,
      nextAction: 'Write a proposed_update and hand off to the integration session.',
    });
  }

  if (normalizedActor === 'project_overview' && normalizedAction !== 'overview_read') {
    return deny({
      actor: normalizedActor,
      action: normalizedAction,
      surface: protectedSurface,
      reason: `project_overview is read-only and cannot perform ${normalizedAction}`,
      nextAction: 'Use project_overview only for read-only overview_read.',
    });
  }

  if (normalizedAction === 'push') {
    if (['integration_session', 'project_main_session'].includes(normalizedActor) && PUSH_APPROVAL_MODES.has(String(pushPolicy))) {
      return allow({
        actor: normalizedActor,
        action: normalizedAction,
        surface: protectedSurface,
        reason: `push allowed by explicit push policy: ${pushPolicy}`,
      });
    }
    return deny({
      actor: normalizedActor,
      action: normalizedAction,
      surface: protectedSurface,
      reason: 'push requires separate PO approval and is never automatic by default',
      requiresApproval: true,
      nextAction: 'Ask for PO approval, then rerun with --push-policy po-confirmed.',
    });
  }

  if (ALLOWED_ACTIONS[normalizedActor].has(normalizedAction)) {
    return allow({
      actor: normalizedActor,
      action: normalizedAction,
      surface: protectedSurface,
    });
  }

  return deny({
    actor: normalizedActor,
    action: normalizedAction,
    surface: protectedSurface,
    reason: `${normalizedActor} cannot perform ${normalizedAction} on ${protectedSurface}`,
    nextAction: 'Use the actor-specific guarded command surface for this action.',
  });
}

export class PolicyDeniedError extends Error {
  constructor(decision) {
    super(`${decision.actor} denied ${decision.action} on ${decision.surface}. next_action: ${decision.next_action}`);
    this.name = 'PolicyDeniedError';
    this.decision = decision;
  }
}

export function assertPolicyAction(options = {}) {
  const decision = decidePolicyAction(options);
  if (!decision.allowed) throw new PolicyDeniedError(decision);
  return decision;
}
