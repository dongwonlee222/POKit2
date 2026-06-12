export const STATUS_ENUM = ['candidate', 'accepted', 'in_progress', 'gate_passed', 'deferred', 'dropped'];

const CANONICAL_STATE_MAP = {
  gate_passed: 'gate_passed',
  release_candidate: 'gate_passed',
  scoped: 'gate_passed',
};

export function isValidStatus(s) {
  return STATUS_ENUM.includes(s);
}

export function deriveStatus(frontmatter) {
  if (frontmatter.status != null) {
    return isValidStatus(frontmatter.status) ? frontmatter.status : null;
  }
  const mapped = CANONICAL_STATE_MAP[frontmatter.canonical_state];
  return mapped ?? null;
}
