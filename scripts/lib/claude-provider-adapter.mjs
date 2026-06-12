import { ISSUE_ID_PATTERN } from './issue-id.mjs';
export {
  MODEL_BY_TIER,
  resolveModelForTier,
} from './assignment-model-tiers.mjs';
import { resolveModelForTier } from './assignment-model-tiers.mjs';

export const ADAPTER_SCHEMA_VERSION = '0.1.0';
export { ISSUE_ID_PATTERN };

export function isClaudeRuntime(env = process.env) {
  return Boolean(
    env.CLAUDECODE ||
    env.CLAUDE_CODE_ENTRYPOINT ||
    Object.keys(env).some(k => k.startsWith('ANTHROPIC_'))
  );
}

export function translateWorkerTask(task) {
  const workerKind = task.worker_kind ?? task.worker_type;
  const permLevel = task.permission_level;
  const isReadOnly = permLevel === 'read_only' || permLevel === 'read-only';
  const isWriteScoped = permLevel === 'write_scoped';

  const allowedLine = task.allowed_paths?.length
    ? `Allowed files (write only these): ${task.allowed_paths.join(', ')}`
    : '';
  const readOnlyLine = isReadOnly
    ? 'READ-ONLY: return data only, do not modify files'
    : '';

  const promptParts = [task.purpose, allowedLine, readOnlyLine].filter(Boolean);

  const agentTypeMap = { review_worker: 'code-reviewer' };

  return {
    label: task.id ?? task.title,
    prompt: promptParts.join('\n'),
    model: resolveModelForTier(task.model_tier ?? 'standard'),
    agentType: agentTypeMap[workerKind],
    isolation: isWriteScoped ? 'worktree' : undefined,
    readOnly: isReadOnly ? true : false,
  };
}

export function planFanOut(workerTasks, { runtimePreference, env = process.env } = {}) {
  if (runtimePreference !== 'claude') {
    return {
      active: false,
      mode: 'inactive',
      reason: 'runtime_preference_not_claude',
      agents: [],
    };
  }

  const agents = workerTasks.map(translateWorkerTask);
  // Threshold counts write-scoped workers only: those need worktree isolation,
  // which is exactly what a parallel Workflow buys. Read-only workers can run as
  // plain parallel agent() calls and do not raise the routing to a Workflow.
  const writeScopedCount = workerTasks.filter(
    t => t.permission_level === 'write_scoped'
  ).length;
  const mode = writeScopedCount >= 3 ? 'workflow' : 'single-agent';

  return { active: true, mode, agents, writeScopedCount };
}

// POK-200 — connective glue that pokit-issue Step 3 consults to choose how to
// dispatch Worker Tasks. It derives runtimePreference from the live env, runs
// planFanOut, and maps plan.mode to a concrete dispatch directive `tool`:
//   - 'workflow' : runtime=claude AND write-scoped workers >= 3 → real Workflow fan-out
//   - 'agent'    : runtime=claude AND below threshold            → parallel Agent dispatch
//   - 'existing' : runtime != claude (codex/antigravity)         → unchanged existing path
// Pure decision only: it spawns nothing. The main session owns the actual dispatch.
export function resolveFanOutPlan(workerTasks, { env = process.env } = {}) {
  const runtimePreference = isClaudeRuntime(env) ? 'claude' : 'other';
  const plan = planFanOut(workerTasks, { runtimePreference, env });
  let tool;
  if (plan.mode === 'workflow') tool = 'workflow';
  else if (plan.mode === 'single-agent') tool = 'agent';
  else if (plan.mode === 'inactive') tool = 'existing';
  // Defensive: a future planFanOut mode must be mapped explicitly, not silently
  // routed to 'existing' (which would hide a real Workflow opportunity).
  else throw new Error(`unknown plan mode: ${plan.mode}`);
  return { ...plan, runtimePreference, tool };
}
