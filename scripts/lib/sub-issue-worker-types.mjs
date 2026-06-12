// POK-120 Sub-issue Worker Types (SSoT).
// Defines the closed set of worker_type values allowed in sub-issue YAML blocks.

export const VALID_WORKER_TYPES = Object.freeze([
  'docs_worker',
  'spec_worker',
  'code_worker',
  'cleanup_worker',
  'review_worker',
  'qa_worker',
])

export function isValidWorkerType(v) {
  return VALID_WORKER_TYPES.includes(v)
}

// Returns v if valid; throws a TypeError with a descriptive message if not.
export function validateWorkerType(v) {
  if (isValidWorkerType(v)) return v
  throw new TypeError(
    `worker_type: invalid value "${v}" — allowed: ${VALID_WORKER_TYPES.join(', ')}`
  )
}
