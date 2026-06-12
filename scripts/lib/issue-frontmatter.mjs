// POK-328 — shared issue-card frontmatter accessors (레버 2: 필드 읽기는 길목 하나로).
//
// Why: checks that hand-read frontmatter fields die silently when a field is
// renamed. v010_metrics_evidence read only `sprint:` while modern cards write
// `sprint_candidate:` — the check skipped every current card for a full version
// cycle without a sound (POK-320/321/322 metrics gap went undetected). Field
// reads with rename history MUST go through this module so the next rename has
// exactly one place to fix.
//
// POK-339 — parseFrontmatter was duplicated in 7 files; consolidated here.
// Excluded: scripts/hooks/session-start.mjs — starter bundle member, must be
// self-contained (issue-frontmatter.mjs is not shipped with the starter bundle).

/**
 * Normalise a raw YAML scalar value from a frontmatter line.
 * - empty string  → true   (bare key with no value)
 * - "null"        → null
 * - quoted string → unquoted string
 * - anything else → trimmed string
 */
function normalizeValue(value) {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (trimmed === 'null') return null;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

/**
 * Parse a YAML-lite frontmatter block from a Markdown string.
 *
 * Supports:
 *   - scalar values (empty → true, "null" → null, quoted strings stripped)
 *   - inline list items under a preceding key (lines starting with `- `)
 *
 * NOTE: scripts/hooks/session-start.mjs keeps its own copy intentionally —
 * it is distributed as part of the starter bundle where this module is not
 * present. Do NOT import this function there.
 *
 * @param {string} text  Full file content including the frontmatter block.
 * @returns {Record<string, unknown>}
 */
export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result = {};
  let pendingKey = null;
  for (const line of match[1].split('\n')) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      pendingKey = keyValue[1];
      result[pendingKey] = normalizeValue(keyValue[2]);
      continue;
    }

    const listValue = line.match(/^\s*-\s*(.+)$/);
    if (listValue && pendingKey) {
      if (!Array.isArray(result[pendingKey])) result[pendingKey] = [];
      result[pendingKey].push(normalizeValue(listValue[1]));
    }
  }

  return result;
}

/**
 * Resolve the sprint label of an issue card from parsed frontmatter.
 * Reads `sprint:` (legacy) then `sprint_candidate:` (current). Returns '' when neither exists.
 */
export function resolveIssueSprint(frontmatter = {}) {
  const value = frontmatter.sprint ?? frontmatter.sprint_candidate ?? '';
  return typeof value === 'string' ? value : '';
}
