// POK-230 (AC2) — Pure conversion from Claude Code Agent/Task usage notifications
// into the metrics `subagents[]` shape, so the orchestrator stops hand-typing
// token numbers on the Agent (Task) path.
//
// The Claude Code Agent/Task result exposes a usage block shaped roughly like:
//   { subagent_tokens: <n>, tool_uses: <n>, duration_ms: <n> }
// and the orchestrator knows each worker's role/model. This module maps those
// entries onto the agreed subagent entry shape:
//   { model, worker_type, total_tokens [, duration_ms] [, tool_uses] }
//
// Honest-metrics rules (mirrors issue-metrics.mjs subagents normalization):
//   - drop non-object entries (null/array/primitive) — never throw on bad input.
//   - coerce every field to a safe type.
//   - absent/invalid token → 0, which by the POKit convention means 미수집
//     (total_tokens === 0 ⟺ unmeasured, D2).
//   - duration_ms / tool_uses are OPTIONAL additive fields: only emitted when a
//     real (non-negative integer) value is present, so their absence is itself
//     the honest "미수집" signal rather than a fake 0.

// Mirrors issue-metrics.mjs nonNegativeInteger (not exported there). NaN/negative/
// float → safe non-negative integer; never propagates a fake value.
function nonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

// Returns a non-negative integer when the input coerces to a finite, non-negative
// number; otherwise undefined (so the optional field is omitted entirely = 미수집).
function optionalNonNegativeInteger(value) {
  if (value == null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return Math.trunc(number);
}

/**
 * Convert Agent/Task usage notification entries into the metrics subagents[] shape.
 *
 * @param {Array<object>} entries - each: {
 *   worker_kind?, worker_type?, model?,
 *   subagent_tokens?|total_tokens?, duration_ms?, tool_uses?
 * }
 * @returns {Array<{ model: string, worker_type: string, total_tokens: number,
 *                   duration_ms?: number, tool_uses?: number }>}
 */
export function parseAgentUsage(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      // Token source: prefer subagent_tokens (the Agent/Task usage field), then
      // total_tokens (already-normalized callers). Absent/invalid → 0 (미수집).
      const tokenSource = entry.subagent_tokens != null ? entry.subagent_tokens : entry.total_tokens;

      const out = {
        model: String(entry.model ?? 'unknown'),
        // worker_type with worker_kind fallback (Agent path labels the role as worker_kind).
        worker_type: String(entry.worker_type ?? entry.worker_kind ?? 'unknown'),
        total_tokens: nonNegativeInteger(tokenSource),
      };

      const durationMs = optionalNonNegativeInteger(entry.duration_ms);
      if (durationMs !== undefined) out.duration_ms = durationMs;

      const toolUses = optionalNonNegativeInteger(entry.tool_uses);
      if (toolUses !== undefined) out.tool_uses = toolUses;

      return out;
    });
}
