export const ISSUE_ID_SOURCE = '[A-Z][A-Z0-9]*-\\d{3,}';
export const ISSUE_ID_PATTERN = new RegExp(`^${ISSUE_ID_SOURCE}$`);
export const ISSUE_ID_GLOBAL_PATTERN = new RegExp(ISSUE_ID_SOURCE, 'g');
export const ISSUE_FILE_PATTERN = new RegExp(`^${ISSUE_ID_SOURCE}\\.md$`, 'i');

export function normalizeIssueId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function isIssueId(value) {
  return ISSUE_ID_PATTERN.test(normalizeIssueId(value));
}

export function assertIssueId(value, label = 'issue id') {
  const issueId = normalizeIssueId(value);
  if (!isIssueId(issueId)) {
    throw new Error(`Invalid ${label}: ${value ?? '<missing>'}`);
  }
  return issueId;
}

export function extractIssueId(value) {
  const match = normalizeIssueId(value).match(ISSUE_ID_GLOBAL_PATTERN);
  return match?.[0] ?? null;
}

export function isIssueFileName(value) {
  return typeof value === 'string' && ISSUE_FILE_PATTERN.test(value.trim());
}
