import { VALID_AGENT_PROFILES, isValidAgentProfile } from './optional-fields.mjs';

const DISPATCH_CONTRACT = Object.freeze({
  planner: Object.freeze({
    profile: 'planner',
    permission_level: 'propose_only',
    role: 'planner',
    purpose: 'propose scoped plans and task breakdowns for main-agent judgment',
  }),
  coder: Object.freeze({
    profile: 'coder',
    permission_level: 'write_scoped',
    role: 'coder',
    purpose: 'implement scoped code changes without final judgment authority',
  }),
  reviewer: Object.freeze({
    profile: 'reviewer',
    permission_level: 'read_only',
    role: 'reviewer',
    purpose: 'review findings and risks as input evidence for the main agent',
  }),
});

export const DISPATCHER_AGENT_PROFILES = Object.freeze([...VALID_AGENT_PROFILES]);
export const AGENT_PROFILE_DISPATCH = DISPATCH_CONTRACT;

export function isDispatchableAgentProfile(value) {
  return isValidAgentProfile(value);
}

export function resolveAgentProfileDispatch(agentProfile) {
  if (!isDispatchableAgentProfile(agentProfile)) {
    throw new Error(
      `invalid agent_profile "${agentProfile}" — allowed: ${DISPATCHER_AGENT_PROFILES.join(', ')}`
    );
  }
  return AGENT_PROFILE_DISPATCH[agentProfile];
}
