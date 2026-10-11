import test from 'node:test';
import assert from 'node:assert/strict';
import { requestModelWithRetry } from '../scripts/model-retry.mjs';

const limits = { maxModelMinutes: 10, maxModelAttempts: 5, maxModelIdleSeconds: 100 };
const failure = code => Object.assign(new Error('synthetic model failure'), { code, evidence: { estimatedCny: 0.1 } });
const result = () => ({ output: '{}', evidence: { estimatedCny: 0.1 } });

function clock() {
  let time = 0;
  const delays = [];
  return { now: () => time, advance: ms => { time += ms; }, sleep: async ms => { delays.push(ms); time += ms; }, delays, log: () => {} };
}

test('four slow transient failures recover on attempt five within one ten-minute window', async () => {
  const timer = clock();
  const attempts = [];
  const codes = ['MODEL_TIMEOUT', 'MODEL_SERVICE_FAILED', 'MODEL_STREAM_INCOMPLETE', 'MODEL_EMPTY_RESPONSE'];
  const answer = await requestModelWithRetry({ ...timer, limits, deadline: 3_600_000, request: async input => {
    attempts.push(input);
    assert.equal(input.deadline, 600_000);
    assert.equal(input.idleTimeoutMs, 100_000);
    assert.equal(input.spentCny, (input.attempt - 1) / 10);
    timer.advance(100_000);
    if (input.attempt < 5) throw failure(codes[input.attempt - 1]);
    return result();
  } });
  assert.deepEqual(timer.delays, [5000, 10000, 20000, 40000]);
  assert.equal(attempts.length, 5);
  assert.equal(answer.evidence.modelAttempts, 5);
  assert.equal(answer.evidence.modelFailures.length, 4);
  assert.equal(answer.evidence.estimatedCny, 0.5);
  assert.equal(answer.evidence.modelRetryDurationMs, 575_000);
});

test('five exhausted requests stop with cumulative cost and the original error classification', async () => {
  const timer = clock();
  await assert.rejects(requestModelWithRetry({ ...timer, limits, deadline: 600_000, request: async () => {
    timer.advance(100_000);
    throw failure('MODEL_SERVICE_FAILED');
  } }), e => e.code === 'MODEL_SERVICE_FAILED' && e.evidence.modelAttempts === 5 && e.evidence.estimatedCny === 0.5);
  assert.equal(timer.now(), 575_000);
});

test('earlier overall deadline shortens the next request and prevents another backoff', async () => {
  const timer = clock();
  const deadlines = [];
  await assert.rejects(requestModelWithRetry({ ...timer, limits, deadline: 180_000, request: async input => {
    deadlines.push(timer.now() + input.idleTimeoutMs);
    timer.advance(input.idleTimeoutMs);
    throw failure('MODEL_TIMEOUT');
  } }), e => e.code === 'MODEL_TIMEOUT' && e.evidence.modelAttempts === 2);
  assert.deepEqual(deadlines, [100_000, 180_000]);
  assert.deepEqual(timer.delays, [5000]);
  assert.equal(timer.now(), 180_000);
});

test('authentication, rejected requests and budget exhaustion stop immediately', async () => {
  for (const code of ['MODEL_AUTH_FAILED', 'MODEL_REQUEST_REJECTED', 'BUDGET_EXHAUSTED']) {
    const timer = clock();
    let attempts = 0;
    await assert.rejects(requestModelWithRetry({ ...timer, limits, deadline: 600_000, request: async () => {
      attempts++;
      throw failure(code);
    } }), { code });
    assert.equal(attempts, 1);
    assert.deepEqual(timer.delays, []);
  }
});

test('a result returned beyond the shared deadline cannot become a successful completion', async () => {
  const timer = clock();
  await assert.rejects(requestModelWithRetry({ ...timer, limits: { ...limits, maxModelAttempts: 1 }, deadline: 600_000, request: async () => {
    timer.advance(600_001);
    return result();
  } }), { code: 'MODEL_TIMEOUT' });
});


test('an active slow stream may finish after 100 seconds within the shared deadline', async () => {
  const timer = clock();
  const answer = await requestModelWithRetry({ ...timer, limits, deadline: 600_000, request: async () => {
    timer.advance(150_000);
    return result();
  } });
  assert.equal(answer.evidence.modelAttempts, 1);
  assert.equal(answer.evidence.modelRetryDurationMs, 150_000);
});


test('truncated or malformed model output can recover without accepting the failed draft', async () => {
  for (const code of ['MODEL_OUTPUT_TRUNCATED', 'DRAFT_OUTPUT_INVALID', 'DRAFT_SCHEMA_INVALID']) {
    const timer = clock();
    const answer = await requestModelWithRetry({ ...timer, limits, deadline: 600_000, request: async ({ attempt }) => {
      if (attempt === 1) throw failure(code);
      return result();
    } });
    assert.equal(answer.evidence.modelAttempts, 2);
    assert.equal(answer.evidence.modelFailures[0].code, code);
    assert.equal(answer.evidence.estimatedCny, 0.2);
  }
});
