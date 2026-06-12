// POK-071 Failure Memory Routing Automation — L2 Hardening
// Provides consistency verification and semi-automatic update helpers.

// Parse prevention_rule values referenced in ai-failure-log.md
// Returns a Set of rule IDs (e.g. 'AFR-001', 'FRG-001')
export function parseFailureLogRuleIds(text) {
  const pattern = /^\s*prevention_rule:\s*(\S+)/gm;
  const ids = new Set();
  for (const match of text.matchAll(pattern)) {
    ids.add(match[1].replace(/,$/, ''));
  }
  return ids;
}

// Parse rule section headers from prevention-rules.md
// Returns a Set of rule IDs declared as ## RULE-ID
export function parsePreventionRuleIds(text) {
  const pattern = /^## (FRG-\d+|AFR-\d+)\b/gm;
  const ids = new Set();
  for (const match of text.matchAll(pattern)) {
    ids.add(match[1]);
  }
  return ids;
}

// Verify that every rule referenced in failure-log exists in prevention-rules.
// One-directional: preemptive rules (not in log) are allowed.
// Returns { valid: boolean, errors: string[], warnings: string[] }
export function verifyFailureMemoryConsistency({ failureLogText, preventionRulesText }) {
  const errors = [];
  const warnings = [];

  const logRuleIds = parseFailureLogRuleIds(failureLogText);
  const ruleIds = parsePreventionRuleIds(preventionRulesText);

  for (const id of logRuleIds) {
    if (!ruleIds.has(id)) {
      errors.push(`Failure log references rule ${id} but no ## ${id} section found in prevention-rules.md.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Apply a failure occurrence to failure-index.md text:
// increments the Frequency column and updates Last Seen for rows matching triggerId.
// Returns { text: updatedText, updated: boolean }
export function applyFailureRecord(indexText, { triggerId, lastSeen }) {
  const lines = indexText.split('\n');
  let updated = false;

  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.includes(triggerId)) return line;
    const parts = line.split('|');
    // 9-column row: [empty, Trigger, TaskType, Rule, Checklist, Status, Severity, ReadWhen, Frequency, LastSeen, empty]
    if (parts.length < 11) return line;
    const freq = parseInt(parts[8].trim(), 10);
    if (isNaN(freq)) return line;
    parts[8] = ` ${freq + 1} `;
    parts[9] = ` ${lastSeen} `;
    updated = true;
    return parts.join('|');
  });

  return { text: result.join('\n'), updated };
}
