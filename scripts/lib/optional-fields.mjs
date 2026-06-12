// POK-038 Optional Fields contract (SSoT).
// parseFrontmatter sentinels treated as "absent":
//   undefined / true (`key:` blank value) / "[]" (inline empty array string).

export const VALID_AGENT_PROFILES = ['planner', 'coder', 'reviewer'];
export const DEPENDS_ON_PATTERN = /^POK-\d{3}$/;
export const GOAL_SOFT_LIMIT = 120;
export const AI_SELF_VERIFY_ITEM_LIMIT = 20;
export const AI_SELF_VERIFY_ITEM_CHAR_LIMIT = 200;

Object.freeze(VALID_AGENT_PROFILES);

// Treat undefined / true (parser blank-value sentinel) / "[]" inline as absent.
// Explicit `null` is a typed value the user wrote — reject it.
function isAbsent(value) {
  return value === undefined || value === true || value === '[]';
}

export function isValidAgentProfile(value) {
  return VALID_AGENT_PROFILES.includes(value);
}

export function validateDependsOn(value, options = {}) {
  if (isAbsent(value)) return { valid: true, errors: [], warnings: [] };

  const errors = [];
  const warnings = [];

  if (!Array.isArray(value)) {
    errors.push(`depends_on: must be a YAML array (got ${value === null ? 'null' : typeof value})`);
    return { valid: false, errors, warnings };
  }

  if (value.length === 0) return { valid: true, errors, warnings };

  const { currentId, knownIds } = options;
  const knownSet = knownIds instanceof Set ? knownIds : Array.isArray(knownIds) ? new Set(knownIds) : null;
  const seen = new Set();

  for (const item of value) {
    if (typeof item !== 'string' || !DEPENDS_ON_PATTERN.test(item)) {
      errors.push(`depends_on: invalid item "${item}" (expected ^POK-\\d{3}$)`);
      continue;
    }
    if (currentId && item === currentId) {
      errors.push(`depends_on: self-reference "${item}" not allowed`);
      continue;
    }
    if (seen.has(item)) {
      warnings.push(`depends_on: duplicate entry "${item}"`);
    } else {
      seen.add(item);
    }
    if (knownSet && !knownSet.has(item)) {
      warnings.push(`depends_on: referenced issue "${item}" not found in .ai-os`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAgentProfile(value) {
  if (isAbsent(value)) return { valid: true, errors: [] };

  if (Array.isArray(value)) {
    return { valid: false, errors: [`agent_profile: must be a single string, not an array`] };
  }
  if (typeof value !== 'string') {
    return { valid: false, errors: [`agent_profile: must be a string (got ${typeof value})`] };
  }
  if (!isValidAgentProfile(value)) {
    return {
      valid: false,
      errors: [
        `agent_profile: invalid value "${value}" — allowed: ${VALID_AGENT_PROFILES.join(', ')}`,
      ],
    };
  }
  return { valid: true, errors: [] };
}

export function validateGoal(value) {
  if (isAbsent(value)) return { valid: true, errors: [], warnings: [] };

  const errors = [];
  const warnings = [];

  if (Array.isArray(value)) {
    errors.push(`goal: must be a single string, not an array`);
    return { valid: false, errors, warnings };
  }
  if (typeof value !== 'string') {
    errors.push(`goal: must be a string (got ${typeof value})`);
    return { valid: false, errors, warnings };
  }
  if (value.trim().length === 0) {
    errors.push(`goal: must not be empty or whitespace-only`);
    return { valid: false, errors, warnings };
  }
  if (value.length > GOAL_SOFT_LIMIT) {
    warnings.push(`goal: ${value.length} chars exceeds ${GOAL_SOFT_LIMIT}-char soft limit`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAiSelfVerify(value) {
  if (isAbsent(value)) return { valid: true, errors: [], warnings: [] };

  const errors = [];
  const warnings = [];

  if (!Array.isArray(value)) {
    errors.push(`ai_self_verify: must be a YAML array (got ${typeof value})`);
    return { valid: false, errors, warnings };
  }

  if (value.length === 0) {
    warnings.push(`ai_self_verify: empty array — add at least one assertion`);
    return { valid: true, errors, warnings };
  }

  if (value.length > AI_SELF_VERIFY_ITEM_LIMIT) {
    warnings.push(
      `ai_self_verify: ${value.length} items exceeds ${AI_SELF_VERIFY_ITEM_LIMIT} soft limit`
    );
  }

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`ai_self_verify[${i}]: must be a non-empty string`);
      continue;
    }
    if (item.length > AI_SELF_VERIFY_ITEM_CHAR_LIMIT) {
      warnings.push(
        `ai_self_verify[${i}]: ${item.length} chars exceeds ${AI_SELF_VERIFY_ITEM_CHAR_LIMIT}-char soft limit`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateOptionalFields(frontmatter, context = {}) {
  const { currentId, knownIds } = context;

  const results = [
    validateDependsOn(frontmatter.depends_on, { currentId, knownIds }),
    validateAgentProfile(frontmatter.agent_profile),
    validateGoal(frontmatter.goal),
    validateAiSelfVerify(frontmatter.ai_self_verify),
  ];

  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings ?? []);

  return { valid: errors.length === 0, errors, warnings };
}
