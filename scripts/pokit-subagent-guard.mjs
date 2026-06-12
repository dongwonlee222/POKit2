#!/usr/bin/env node

const DEFAULT_WAIT_BUDGET_MS = 60_000;
const REQUIRED_FALLBACK_FIELDS = [
  'reason_for_fallback',
  'elapsed_wait_or_timeout_marker',
  'replacement_verification_command',
  'root_cause_category',
  'residual_risk',
];

export function validateSubagentVerificationSequence(events, options = {}) {
  const waitBudgetMs = options.waitBudgetMs ?? DEFAULT_WAIT_BUDGET_MS;
  const orderedEvents = [...events].sort((a, b) => a.at_ms - b.at_ms);
  const request = orderedEvents.find((event) => event.type === 'subagent_verification_requested');

  if (!request) {
    return pass('no_subagent_verification_request');
  }

  const dispatch = firstAfter(orderedEvents, 'subagent_dispatched', request.at_ms);
  const broadRead = firstAfter(orderedEvents, 'broad_context_read', request.at_ms);

  if (!dispatch) {
    return fail('dispatch_missing', {
      elapsed_ms: elapsedFrom(request, lastEvent(orderedEvents)),
    });
  }

  if (broadRead && broadRead.at_ms < dispatch.at_ms) {
    return fail('broad_read_before_dispatch', {
      elapsed_ms: broadRead.at_ms - request.at_ms,
    });
  }

  const result = firstAfter(orderedEvents, 'subagent_result_received', dispatch.at_ms);
  const fallback = firstAfter(orderedEvents, 'fallback_recorded', dispatch.at_ms);

  if (result && result.at_ms - dispatch.at_ms <= waitBudgetMs) {
    return pass('subagent_result_within_budget', {
      elapsed_ms: result.at_ms - dispatch.at_ms,
    });
  }

  if (fallback) {
    const missing = REQUIRED_FALLBACK_FIELDS.filter((field) => !fallback[field]);
    if (missing.length > 0) {
      return fail('fallback_record_incomplete', {
        elapsed_ms: fallback.at_ms - dispatch.at_ms,
        missing,
      });
    }

    if (fallback.at_ms - dispatch.at_ms <= waitBudgetMs) {
      return pass('fallback_record_within_budget', {
        elapsed_ms: fallback.at_ms - dispatch.at_ms,
      });
    }
  }

  const completion = result ?? fallback ?? lastEvent(orderedEvents);
  return fail('wait_budget_exceeded_without_fallback', {
    elapsed_ms: elapsedFrom(dispatch, completion),
  });
}

function firstAfter(events, type, atMs) {
  return events.find((event) => event.type === type && event.at_ms >= atMs) ?? null;
}

function lastEvent(events) {
  return events.at(-1) ?? { at_ms: 0 };
}

function elapsedFrom(start, end) {
  return Math.max(0, end.at_ms - start.at_ms);
}

function pass(reason, extra = {}) {
  return {
    status: 'pass',
    rule: 'AFR-001',
    reason,
    ...extra,
  };
}

function fail(reason, extra = {}) {
  return {
    status: 'fail',
    rule: 'AFR-001',
    reason,
    ...extra,
  };
}
