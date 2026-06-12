#!/usr/bin/env node
import { backfillAfterGatePassEvents } from './lib/after-gate-pass-natural-hook.mjs';

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 20;
const result = await backfillAfterGatePassEvents({
  root: process.cwd(),
  limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
});

process.stdout.write(`${JSON.stringify(result)}\n`);
