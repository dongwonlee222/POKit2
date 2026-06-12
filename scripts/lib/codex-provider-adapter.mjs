import {
  buildProviderAdapterReceipt,
  deriveProviderEventId,
  deriveSideEffectIdempotencyKey,
  runAfterGateProviderAdapter,
  validateCoreAfterGatePassEvent,
} from './provider-receipt-adapter.mjs';

const PROVIDER = 'codex';

export function isCodexRuntime(env = process.env) {
  return Boolean(
    env.CODEX_ENV ||
    env.CODEX_SESSION_ID ||
    env.CODEX_THREAD_ID ||
    env.CODEX_SHELL ||
    env.CODEX_CI ||
    String(env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE ?? '').toLowerCase().includes('codex')
  );
}

export { deriveSideEffectIdempotencyKey, validateCoreAfterGatePassEvent };

export function deriveCodexEventId(event) {
  return deriveProviderEventId(event, PROVIDER);
}

export function buildCodexAdapterReceipt(options = {}) {
  return buildProviderAdapterReceipt({ ...options, provider: PROVIDER });
}

export async function runCodexProviderAdapter({
  root = process.cwd(),
  issueId,
  now,
  eventLogPath = '.ai-os/events/event-log.jsonl',
  artifactPath = null,
  runtimeProofPath = '.ai-os/runtime-proof/codex.md',
  env = process.env,
} = {}) {
  const defaultArtifactPath = artifactPath ?? `.ai-os/events/provider-receipts/codex/${issueId}-codex-adapter-receipt.json`;
  return runAfterGateProviderAdapter({
    root,
    issueId,
    now,
    eventLogPath,
    artifactPath,
    defaultArtifactPath,
    runtimeProofPath,
    provider: PROVIDER,
    runtimeDetected: isCodexRuntime(env),
    runtimeMessage: 'Codex adapter handled core after_gate_pass event.',
    outsideRuntimeMessage: 'Codex adapter handled core after_gate_pass event outside detected Codex env.',
  });
}
