import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseFrontmatter } from './derived-index.mjs';

// POK-141 — parse a YAML-ish date/datetime value from issue card frontmatter
// into an epoch ms. Date-only ("YYYY-MM-DD") is interpreted as that day at
// 00:00 UTC. Returns null when the value is unparseable.
export function parseFrontmatterTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  // Date-only — interpret as UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const ms = Date.parse(`${text}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

// POK-141 — read issue card frontmatter and derive (startedAt, endedAt) for
// duration_ms. Falls back gracefully when fields are missing.
//
// POK-198: same-day case (endedAt <= startedAt from date-only frontmatter)
// now yields duration_ms === 0 (un-bumped fallback). The +86_400_000 fake-day
// bump has been removed. Real wall-clock duration is captured via the start
// marker at execution-approval time (recordIssueStartMarker in pokit-runner).
export async function deriveIssueDurationFromCard(root, issueId) {
  if (!/^POK-\d{3}$/.test(issueId ?? '')) {
    return { startedAt: null, endedAt: null };
  }
  const issuePath = path.join(root, 'projects/pokit/issues', `${issueId}.md`);
  let text;
  try {
    text = await readFile(issuePath, 'utf8');
  } catch {
    return { startedAt: null, endedAt: null };
  }
  const fm = parseFrontmatter(text);
  const startedAt =
    parseFrontmatterTimestamp(fm.created_at) ??
    parseFrontmatterTimestamp(fm.updated_at);
  const endedAt =
    parseFrontmatterTimestamp(fm.gate_passed_at) ??
    parseFrontmatterTimestamp(fm.updated_at);

  // Same-day date-only: endedAt <= startedAt, so durationMs clamps to 0.
  // This is intentional — "측정 안 함" when no start marker was captured.
  return { startedAt, endedAt };
}
