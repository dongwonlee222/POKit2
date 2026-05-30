#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const logPath = path.join(root, '.ai-os', 'events', 'event-log.jsonl');
let text = '';

try {
  text = await readFile(logPath, 'utf8');
} catch {
  console.log(JSON.stringify({ status: 'pass', events: [] }, null, 2));
  process.exit(0);
}

const events = [];
for (const [index, line] of text.split('\n').entries()) {
  if (!line.trim()) continue;
  try {
    const event = JSON.parse(line);
    events.push({
      line: index + 1,
      event_type: event.event_type ?? event.event_name ?? 'unknown',
      issue_id: event.issue_id ?? null,
      emitted_at: event.emitted_at ?? null,
    });
  } catch {
    events.push({ line: index + 1, event_type: 'malformed_json', issue_id: null, emitted_at: null });
  }
}

console.log(JSON.stringify({
  status: 'pass',
  source: '.ai-os/events/event-log.jsonl',
  events,
}, null, 2));
