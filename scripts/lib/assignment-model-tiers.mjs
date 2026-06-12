export const MODEL_BY_TIER = Object.freeze({
  max: 'opus',
  strong: 'opus',
  standard: 'sonnet',
  fast: 'haiku',
  // NOTE: fallback on failure goes UPWARD (sonnet->opus), never down to haiku.
});

export const MAIN_AGENT_REQUIRED_ACTIONS = Object.freeze([
  'validate_scope',
  'approve_or_apply_outputs',
  'verify_before_gate_claim',
]);

export const ASSIGNMENT_BY_AGENT_PROFILE = Object.freeze({
  planner: Object.freeze({
    worker_kind: 'planner_worker',
    difficulty: 'standard',
    model_tier: 'strong',
    runtime_preference: 'auto',
    provider_model_source: 'config_resolved_only',
  }),
  coder: Object.freeze({
    worker_kind: 'implementation_worker',
    difficulty: 'standard',
    model_tier: 'standard',
    runtime_preference: 'auto',
    provider_model_source: 'config_resolved_only',
  }),
  reviewer: Object.freeze({
    worker_kind: 'review_worker',
    difficulty: 'standard',
    model_tier: 'strong',
    runtime_preference: 'auto',
    provider_model_source: 'config_resolved_only',
  }),
});

export const DEFAULT_ASSIGNMENT = Object.freeze({
  worker_kind: 'main_session',
  difficulty: 'standard',
  model_tier: 'standard',
  runtime_preference: 'auto',
  provider_model_source: 'config_resolved_only',
  permission_level: 'main_only',
  main_agent_required_actions: MAIN_AGENT_REQUIRED_ACTIONS,
});

export function resolveModelForTier(tier) {
  if (!(tier in MODEL_BY_TIER)) {
    throw new Error(`unknown model tier: ${tier}`);
  }
  return MODEL_BY_TIER[tier];
}
