import {
  buildProviderAdapterReceipt,
  deriveProviderEventId,
  deriveSideEffectIdempotencyKey,
  runAfterGateProviderAdapter,
  validateCoreAfterGatePassEvent,
} from './provider-receipt-adapter.mjs';

const PROVIDER = 'antigravity';

export function isAntigravityRuntime(env = process.env) {
  return Boolean(env.ANTIGRAVITY || env.ANTIGRAVITY_SESSION);
}

export { deriveSideEffectIdempotencyKey, validateCoreAfterGatePassEvent };

export function deriveAntigravityEventId(event) {
  return deriveProviderEventId(event, PROVIDER);
}

export function buildAntigravityAdapterReceipt(options = {}) {
  return buildProviderAdapterReceipt({ ...options, provider: PROVIDER });
}

export async function runAntigravityProviderAdapter({
  root = process.cwd(),
  issueId,
  now,
  eventLogPath = '.ai-os/events/event-log.jsonl',
  artifactPath = null,
  runtimeProofPath = '.ai-os/runtime-proof/antigravity.md',
  env = process.env,
} = {}) {
  const defaultArtifactPath = artifactPath ?? `.ai-os/events/provider-receipts/antigravity/${issueId}-antigravity-adapter-receipt.json`;
  return runAfterGateProviderAdapter({
    root,
    issueId,
    now,
    eventLogPath,
    artifactPath,
    defaultArtifactPath,
    runtimeProofPath,
    provider: PROVIDER,
    runtimeDetected: isAntigravityRuntime(env),
    runtimeMessage: 'Antigravity adapter handled core after_gate_pass event.',
    outsideRuntimeMessage: 'Antigravity adapter handled core after_gate_pass event outside detected Antigravity env.',
  });
}
