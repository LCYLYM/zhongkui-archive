import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSearchWithRetry, retryAfterMs } from '../scripts/search-retry.mjs';

test('search rate limits respect Retry-After and continue the same query', async () => {
  let now = 0, requests = 0;
  const delays = [];
  const evidence = { httpStatus: 429, retryAfterMs: 45_000 };
  const result = await requestSearchWithRetry({ deadline: 120_000, now: () => now, log: () => {}, sleep: async ms => { delays.push(ms); now += ms; }, request: async () => {
    requests++;
    if (requests === 1) throw Object.assign(new Error('synthetic throttling'), { code: 'EXA_SEARCH_FAILED', evidence });
    return 'real-query-result';
  } });
  assert.equal(result, 'real-query-result');
  assert.equal(requests, 2);
  assert.deepEqual(delays, [45_000]);
});

test('search retries cannot ignore the deadline or retry access denial', async () => {
  for (const evidence of [{ httpStatus: 429, retryAfterMs: 180_000 }, { httpStatus: 403, searchFailure: 'ACCESS_DENIED' }]) {
    let requests = 0;
    await assert.rejects(requestSearchWithRetry({ deadline: 120_000, now: () => 0, sleep: async () => assert.fail('must not wait'), request: async () => {
      requests++;
      throw Object.assign(new Error('synthetic search failure'), { code: 'EXA_SEARCH_FAILED', evidence });
    } }), { code: 'EXA_SEARCH_FAILED' });
    assert.equal(requests, 1);
  }
});

test('Retry-After supports seconds and dates without accepting invalid intervals', () => {
  assert.equal(retryAfterMs('45', 0), 45_000);
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:01:00 GMT', 10_000), 50_000);
  assert.equal(retryAfterMs(null), 0);
  assert.equal(retryAfterMs('invalid'), 0);
  assert.equal(retryAfterMs('-1', 0), 0);
});
