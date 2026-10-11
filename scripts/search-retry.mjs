export function retryAfterMs(value, now = Date.now()) {
  if (value == null || value === '') return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export async function requestSearchWithRetry({ request, deadline, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await request(); }
    catch (error) {
      const evidence = error.evidence ?? {};
      const retryable = error.code === 'EXA_SEARCH_FAILED' && (
        evidence.httpStatus === 429 || evidence.httpStatus >= 500 ||
        evidence.searchFailure === 'RATE_LIMITED' || evidence.transportCode
      );
      const delayMs = Math.max(evidence.retryAfterMs ?? 0, 30_000 * 2 ** (attempt - 1));
      if (!retryable || attempt === 3 || now() + delayMs >= deadline) throw error;
      log(`research retry attempt=${attempt}/3 http_status=${evidence.httpStatus ?? 'none'} delay_ms=${delayMs}`);
      await sleep(delayMs);
    }
  }
}
