const retryableCodes = new Set([
  'MODEL_SERVICE_FAILED', 'MODEL_RATE_LIMITED', 'MODEL_TIMEOUT', 'MODEL_NETWORK_FAILED',
  'MODEL_STREAM_INCOMPLETE', 'MODEL_EMPTY_RESPONSE', 'MODEL_PROTOCOL_FAILED',
]);

// One shared deadline includes requests and backoff; the caller enforces each
// attemptDeadline with its AbortController, including response body reads.
export async function requestModelWithRetry({ request, limits, deadline, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  const startedAt = now();
  const retryDeadline = Math.min(deadline, startedAt + Math.min(10, limits.maxModelMinutes) * 60_000);
  const maxAttempts = Math.min(5, Math.max(1, limits.maxModelAttempts));
  const attemptMs = Math.min(100, limits.maxModelAttemptSeconds) * 1000;
  const failures = [];
  let spentCny = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (now() >= retryDeadline) {
      throw Object.assign(new Error('Model retry window expired'), { code: 'MODEL_TIMEOUT', evidence: { estimatedCny: spentCny, modelAttempts: attempt - 1, modelFailures: failures, modelRetryDurationMs: now() - startedAt } });
    }
    const attemptDeadline = Math.min(retryDeadline, now() + attemptMs);
    log(`model attempt=${attempt}/${maxAttempts} attempt_timeout_ms=${attemptDeadline - now()} window_remaining_ms=${retryDeadline - now()}`);
    try {
      const result = await request({ attempt, attemptDeadline, deadline: retryDeadline, spentCny });
      if (now() > attemptDeadline) {
        throw Object.assign(new Error('Model request exceeded its deadline'), { code: 'MODEL_TIMEOUT', evidence: result.evidence });
      }
      result.evidence.estimatedCny = Number((spentCny + result.evidence.estimatedCny).toFixed(6));
      result.evidence.modelAttempts = attempt;
      result.evidence.modelFailures = [...failures];
      result.evidence.modelRetryDurationMs = now() - startedAt;
      if (failures.length) result.evidence.costBasis = 'completion-plus-retry-upper-bounds';
      return result;
    } catch (error) {
      spentCny = Number((spentCny + (error.evidence?.estimatedCny ?? 0)).toFixed(6));
      failures.push({ attempt, code: error.code ?? 'CONTENT_GUARDIAN_FAILED', httpStatus: error.evidence?.httpStatus ?? null, transportCode: error.evidence?.transportCode ?? null });
      error.evidence = { ...error.evidence, estimatedCny: spentCny, modelAttempts: attempt, modelFailures: [...failures], modelRetryDurationMs: now() - startedAt };
      const delayMs = Math.min(40_000, 5000 * 2 ** (attempt - 1));
      if (!retryableCodes.has(error.code) || attempt === maxAttempts || now() + delayMs >= retryDeadline) throw error;
      log(`model retry code=${error.code} http_status=${error.evidence.httpStatus ?? 'none'} delay_ms=${delayMs}`);
      await sleep(delayMs);
    }
  }
}
