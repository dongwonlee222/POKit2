# Test Standard

## Purpose

Prevent active-issue ID hardcoding in tests. Tests that assert `.ai-os/current.md` state must read it dynamically so gate advances never break the test suite.

## Dynamic Read Rule

Tests must not hardcode the active issue ID, next action text, or any value derived from `.ai-os/current.md` frontmatter as a literal in assertions.

State files must not be compared with full-string equality for `next_action`.
Human-facing surfaces such as `.ai-os/status-board.md` and `.ai-os/memory/session/handoff.md`
may summarize the next action, so tests should assert stable tokens with
`assertNextActionTokens()` instead of requiring `Next action: ${nextAction}`.

### Forbidden

```js
assert.equal(result.activeIssue, 'POK-062');
assert.match(current, /active_issue:\s+POK-062/);
assert.ok(statusBoard.includes('Current issue: POK-062'));
```

### Required

Use `tests/lib/test-fixtures.mjs` helpers:

```js
import { getActiveIssue, getNextAction, getCurrentState } from './lib/test-fixtures.mjs';

const activeIssue = await getActiveIssue();
const nextAction = await getNextAction();

assert.equal(result.activeIssue, activeIssue);
assert.ok(current.includes(`active_issue: ${activeIssue}`));
assert.ok(statusBoard.includes(`Current issue: ${activeIssue}`));
assertNextActionTokens(statusBoard, { activeIssue, nextAction });
```

## Exception

Tests that verify historical gate evidence (a specific past gate outcome, archived state, or a named issue file's status) may hardcode POK identifiers. The exception is evident from context: reading `.ai-os/POK-058.md` and asserting `status: gate_passed` is historical, not active state.

## Scope

This standard applies to `tests/*.mjs` and `tests/**/*.mjs`. It does not apply to `scripts/`, `docs/`, or `.ai-os/` content files.
