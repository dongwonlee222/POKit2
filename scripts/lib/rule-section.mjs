// POK-134 Rule Section Rotation — current.md `## Rule` 본문 회전 유틸리티.
// `## Rule` 본문은 gate 로그 누적 영역, `### Precedents (pinned)` 는 영구 pin.
// 본 모듈은 두 섹션을 분리 파싱하고, sprint-close 시 gate 로그만 archive로 회전한다.

const RULE_HEADING = /^## Rule\s*$/m;
const PRECEDENTS_HEADING = /^### Precedents/m;
const NEXT_HEADING = /^(##\s|###\s)/m;
const POK_LINE = /^POK-\d+/;

// Extract `## Rule` section body (between `## Rule` heading and next heading
// boundary: `### ` or `## `). Returns string without the heading line itself.
// Returns empty string when no `## Rule` heading exists.
export function parseRuleSection(content) {
  const headingMatch = content.match(RULE_HEADING);
  if (!headingMatch) return '';

  const startIdx = headingMatch.index + headingMatch[0].length;
  const rest = content.slice(startIdx).replace(/^\n/, '');

  const nextMatch = rest.match(NEXT_HEADING);
  const body = nextMatch ? rest.slice(0, nextMatch.index) : rest;
  return body;
}

// Count lines in `## Rule` body that start with `POK-` (gate log lines).
// Excludes blank lines, blockquotes (`>`), and `### Precedents` section content.
export function countGateLogs(content) {
  const body = parseRuleSection(content);
  if (!body) return 0;

  let count = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('>')) continue;
    if (POK_LINE.test(trimmed)) count += 1;
  }
  return count;
}

// Extract `### Precedents (pinned)` section body. Returns string (without
// heading line) or null when the heading is absent.
export function parsePrecedents(content) {
  const headingMatch = content.match(/^### Precedents[^\n]*$/m);
  if (!headingMatch) return null;

  const startIdx = headingMatch.index + headingMatch[0].length;
  const rest = content.slice(startIdx).replace(/^\n/, '');

  const nextMatch = rest.match(NEXT_HEADING);
  const body = nextMatch ? rest.slice(0, nextMatch.index) : rest;
  return body;
}

// Rotate gate log lines out of `## Rule` body.
//
// - Lines that match `POK-\d+` in the Rule body (excluding `### Precedents`)
//   are pulled into archiveLines (in original order).
// - `### Precedents (pinned)` section is NEVER touched.
// - Blockquote/blank lines in the Rule body are preserved in remainingContent.
//
// Returns:
//   { archiveLines: string[], remainingContent: string }
export function rotateRuleSection(content, _sprint) {
  const headingMatch = content.match(RULE_HEADING);
  if (!headingMatch) {
    return { archiveLines: [], remainingContent: content };
  }

  const startIdx = headingMatch.index + headingMatch[0].length;
  const before = content.slice(0, startIdx);
  let rest = content.slice(startIdx);

  // Preserve a leading newline after `## Rule` heading if present.
  const leadingNl = rest.startsWith('\n') ? '\n' : '';
  rest = rest.slice(leadingNl.length);

  const nextMatch = rest.match(NEXT_HEADING);
  const body = nextMatch ? rest.slice(0, nextMatch.index) : rest;
  const after = nextMatch ? rest.slice(nextMatch.index) : '';

  const archiveLines = [];
  const kept = [];
  for (const line of body.split('\n')) {
    if (POK_LINE.test(line.trim())) {
      archiveLines.push(line);
    } else {
      kept.push(line);
    }
  }

  const newBody = kept.join('\n');
  const remainingContent = `${before}${leadingNl}${newBody}${after}`;
  return { archiveLines, remainingContent };
}
