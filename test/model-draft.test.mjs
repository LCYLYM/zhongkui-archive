import test from 'node:test';
import assert from 'node:assert/strict';
import { validateModelDraftOutput } from '../scripts/model-draft.mjs';
import { requestModelWithRetry } from '../scripts/model-retry.mjs';
const options = { runDate: '2026-10-12', maxItems: 10 };

test('draft structure, date and candidate failures stay classified without exposing model text', () => {
  for (const [output, code, reason] of [
    ['private model text', 'DRAFT_OUTPUT_INVALID', undefined],
    ['{"answer":"private model text"}', 'DRAFT_SCHEMA_INVALID', 'TOP_LEVEL_SCHEMA'],
    ['{"schema":1,"runDate":"2026-10-12","items":[],"unexpected":"private model text"}', 'DRAFT_SCHEMA_INVALID', 'TOP_LEVEL_SCHEMA'],
    ['{"schema":1,"runDate":"2026-10-11","items":[]}', 'DRAFT_SCHEMA_INVALID', 'RUN_DATE_MISMATCH'],
    ['{"schema":1,"runDate":"2026-10-12","items":[{}]}', 'DRAFT_SCHEMA_INVALID', 'CANDIDATES_REJECTED'],
  ]) {
    assert.throws(() => validateModelDraftOutput(output, options), e => e.code === code && e.validationFailure === reason && !e.message.includes('private model text'));
  }
});

test('the retry window returns only a draft that has passed the full content contract', async () => {
  let time = 0, calls = 0;
  const outputs = ['{"answer":"wrong shape"}', '{"schema":1,"runDate":"2026-10-12","items":[]}'];
  const result = await requestModelWithRetry({
    limits: { maxModelAttempts: 5, maxModelMinutes: 10, maxModelIdleSeconds: 100 },
    deadline: 600_000, now: () => time, log: () => {}, sleep: async ms => { time += ms; },
    request: async () => {
      const evidence = { estimatedCny: 0.1 };
      try { return { ...validateModelDraftOutput(outputs[calls++], options), evidence }; }
      catch (error) { throw Object.assign(error, { evidence }); }
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.draft, { schema: 1, runDate: '2026-10-12', items: [] });
  assert.equal(result.evidence.modelFailures[0].validationFailure, 'TOP_LEVEL_SCHEMA');
  assert.equal(result.evidence.estimatedCny, 0.2);
});
