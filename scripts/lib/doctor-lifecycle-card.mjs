// POK-309 — extracted from scripts/pokit-doctor.mjs
// Owns lifecycle-card schema validation: validateLifecycleCardOutput,
// CARD_RENDERER_FIXTURES (private), and checkLifecycleCardSchemas.
// pass/fail helpers are injected by the caller (doctor) to avoid pulling
// in resolveDoctorGuidance as a dependency.

import {
  renderBlockedCard,
  renderCompleteCard,
  renderProgressCard,
  renderSessionCloseCard,
  renderSprintCloseSummaryCard,
  renderStartupLifecycleCard,
} from './lifecycle-card-renderer.mjs';

export function validateLifecycleCardOutput(output) {
  const errors = [];
  if (/[┐┤┘]/.test(output)) {
    errors.push('Card contains right-side border characters (┐┤┘) — violates open-right rule.');
  }
  if (!output.includes('╭─')) {
    errors.push('Card missing top-left opener (╭─).');
  }
  if (!output.includes('╰─')) {
    errors.push('Card missing bottom-left closer (╰─).');
  }
  return { valid: errors.length === 0, errors };
}

const CARD_RENDERER_FIXTURES = [
  {
    name: 'startup',
    fn: () => renderStartupLifecycleCard({
      lifecycleCard: { fields: { current: { project: 'pokit', issue: 'POK-000', state: 'candidate', next: '-' }, input_waiting: { message: '-', guard: '-' } } },
    }),
  },
  {
    name: 'progress',
    fn: () => renderProgressCard({
      progressCard: { fields: { current: { issue: 'POK-000', step: '-', state: '-' }, next: { action: '-' } } },
    }),
  },
  {
    name: 'complete',
    fn: () => renderCompleteCard({
      completeCard: { fields: { result: { issue: 'POK-000', state: '-' }, changes: { summary: '-' }, verification: { tests: '-', doctor: '-', diff: '-' }, next: { action: '-' } } },
    }),
  },
  {
    name: 'blocked',
    fn: () => renderBlockedCard({
      blockedCard: { fields: { current: { issue: 'POK-000', state: '-', reason: '-' }, next: { action: '-' } } },
    }),
  },
  {
    name: 'sprint_close',
    fn: () => renderSprintCloseSummaryCard({
      summaryCard: { fields: { sprint: { name: 'v0.0.0' }, stats: { issues: '-', tests: '-' }, next: { action: '-' } } },
    }),
  },
  {
    name: 'session_close',
    fn: () => renderSessionCloseCard({
      closeCard: { fields: { close: { issue: 'POK-000', state: '-' }, handoff: { next: '-', start: '포킷 시작' } } },
    }),
  },
];

export function checkLifecycleCardSchemas(items, { pass, fail }) {
  for (const { name, fn } of CARD_RENDERER_FIXTURES) {
    let output;
    try {
      output = fn();
    } catch (err) {
      fail(items, 'lifecycle_card_schema', `renderer:${name}`, `Renderer threw: ${err.message}`, 'Fix the renderer function.');
      continue;
    }
    const result = validateLifecycleCardOutput(output);
    if (!result.valid) {
      fail(items, 'lifecycle_card_schema', `renderer:${name}`, result.errors.join(' '), 'Fix the renderer to comply with open-right card standard.');
    } else {
      pass(items, 'lifecycle_card_schema', `renderer:${name}`, `${name} card output passes open-right schema.`);
    }
  }
}
