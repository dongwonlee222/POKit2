import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isIssueId } from './issue-id.mjs';

export const RECEIPT_SCHEMA_VERSION = '0.1.0';
export const AFTER_GATE_PASS_EVENT_NAME = 'after_gate_pass';

export function validateCoreAfterGatePassEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('core event is required');
  if (event.event_name !== AFTER_GATE_PASS_EVENT_NAME && event.event_type !== AFTER_GATE_PASS_EVENT_NAME) {
    throw new Error(`unsupported core event: ${event.event_name ?? event.event_type ?? '<missing>'}`);
  }
  if (!isIssueId(event.issue_id ?? '')) {
    throw new Error(`invalid core event issue_id: ${event.issue_id ?? '<missing>'}`);
  }
  if (event.gate_state !== 'gate_passed' || event.status !== 'gate_passed') {
    throw new Error('core event must be gate_passed');
  }
  const payload = event.payload ?? {};
  for (const key of ['schema_version', 'event_name', 'emitted_at', 'provider', 'issue_id', 'gate_state', 'status']) {
    if (!(key in payload)) throw new Error(`core event payload missing ${key}`);
  }
  if (payload.event_name !== AFTER_GATE_PASS_EVENT_NAME) {
    throw new Error('core event payload event_name must be after_gate_pass');
  }
  if (payload.issue_id !== event.issue_id) throw new Error('core event payload issue_id must match receipt issue_id');
  if (payload.gate_state !== 'gate_passed' || payload.status !== 'gate_passed') {
    throw new Error('core event payload must be gate_passed');
  }
  return event;
}

export function deriveProviderEventId(event, provider) {
  if (event?.event_id) return String(event.event_id);
  if (event?.payload?.event_id) return String(event.payload.event_id);
  const eventName = event?.event_name ?? event?.event_type ?? AFTER_GATE_PASS_EVENT_NAME;
  const issueId = event?.issue_id ?? 'POK-000';
  const auditSeed = JSON.stringify({
    event_name: eventName,
    issue_id: issueId,
    emitted_at: event?.emitted_at ?? event?.payload?.emitted_at ?? '',
    source: event?.source ?? null,
    gate_commit_sha: event?.gate_commit_sha ?? null,
  });
  return `${provider}-${eventName}-${issueId}-${shortHash(auditSeed)}`;
}

export function deriveSideEffectIdempotencyKey(event) {
  const eventName = event?.event_name ?? event?.event_type ?? AFTER_GATE_PASS_EVENT_NAME;
  const issueId = event?.issue_id ?? 'POK-000';
  if (event?.gate_commit_sha) return `${event.gate_commit_sha}:${eventName}:${issueId}`;
  return `${eventName}:${issueId}:gate_passed`;
}

export function buildProviderAdapterReceipt({
  provider,
  event,
  status = 'handled',
  now,
  artifactPath,
  runtimeProofPath = null,
  sourceReceiptPath = null,
  sourceReceiptOffset = null,
  message = null,
  errorCode = null,
} = {}) {
  if (!provider) throw new Error('provider is required');
  validateCoreAfterGatePassEvent(event);
  if (!artifactPath) throw new Error('artifactPath is required');
  const handledAt = now ? new Date(now).toISOString() : new Date().toISOString();
  const receipt = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    provider,
    event_id: deriveProviderEventId(event, provider),
    event_name: AFTER_GATE_PASS_EVENT_NAME,
    issue_id: event.issue_id,
    status,
    emitted_at: event.emitted_at ?? event.payload.emitted_at,
    handled_at: handledAt,
    artifact_path: artifactPath,
    side_effect_idempotency_key: deriveSideEffectIdempotencyKey(event),
  };

  if (sourceReceiptPath) receipt.source_receipt_path = sourceReceiptPath;
  if (Number.isInteger(sourceReceiptOffset)) receipt.source_receipt_offset = sourceReceiptOffset;
  if (runtimeProofPath) receipt.runtime_proof_path = runtimeProofPath;
  if (errorCode) receipt.error_code = errorCode;
  if (message) receipt.message = message;
  return receipt;
}

export async function runAfterGateProviderAdapter({
  root = process.cwd(),
  issueId,
  now,
  eventLogPath = '.ai-os/events/event-log.jsonl',
  artifactPath = null,
  defaultArtifactPath,
  runtimeProofPath,
  provider,
  runtimeDetected,
  runtimeMessage,
  outsideRuntimeMessage,
} = {}) {
  assertIssueId(issueId);
  if (!defaultArtifactPath) throw new Error('defaultArtifactPath is required');
  const events = await readCoreEvents({ root, eventLogPath });
  const matched = findLatestIssueEvent(events, issueId);
  const receiptPath = artifactPath ?? defaultArtifactPath;

  if (!matched) {
    return {
      ok: true,
      status: 'skipped',
      path: null,
      receipt: null,
      reason: 'core_event_not_found',
    };
  }

  const receipt = buildProviderAdapterReceipt({
    provider,
    event: matched.event,
    now,
    artifactPath: receiptPath,
    runtimeProofPath,
    sourceReceiptPath: eventLogPath,
    sourceReceiptOffset: matched.line,
    message: runtimeDetected ? runtimeMessage : outsideRuntimeMessage,
  });

  const writeResult = await writeReceipt({ root, artifactPath: receiptPath, receipt });
  return {
    ok: true,
    status: writeResult.status,
    path: receiptPath,
    receipt: writeResult.receipt,
  };
}

export async function readCoreEvents({ root, eventLogPath }) {
  const fullPath = path.join(root, eventLogPath);
  let text;
  try {
    text = await readFile(fullPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const events = [];
  let lineNumber = 0;
  for (const line of text.split('\n')) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.event_name === AFTER_GATE_PASS_EVENT_NAME || event.event_type === AFTER_GATE_PASS_EVENT_NAME) {
      events.push({ event, line: lineNumber });
    }
  }
  return events;
}

export function findLatestIssueEvent(events, issueId) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (String(events[index].event.issue_id).toUpperCase() === issueId) return events[index];
  }
  return null;
}

export async function writeReceipt({ root, artifactPath, receipt }) {
  const fullPath = path.join(root, artifactPath);
  let existing = null;
  try {
    existing = JSON.parse(await readFile(fullPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (existing) {
    if (existing.event_id === receipt.event_id) {
      return {
        status: 'duplicate',
        receipt: {
          ...existing,
          status: existing.status === 'handled' ? 'duplicate' : existing.status,
        },
      };
    }
    throw new Error(`provider receipt path collision: ${artifactPath}`);
  }

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { status: receipt.status, receipt };
}

function shortHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function assertIssueId(issueId) {
  if (!isIssueId(issueId ?? '')) {
    throw new Error(`Invalid POKit issue id: ${issueId ?? '<missing>'}`);
  }
}
