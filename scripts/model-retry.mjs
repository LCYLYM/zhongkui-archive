const retryableCodes = new Set([
  'MODEL_SERVICE_FAILED', 'MODEL_RATE_LIMITED', 'MODEL_TIMEOUT', 'MODEL_NETWORK_FAILED',
  'MODEL_STREAM_INCOMPLETE', 'MODEL_EMPTY_RESPONSE', 'MODEL_PROTOCOL_FAILED',
  'MODEL_OUTPUT_TRUNCATED', 'DRAFT_OUTPUT_INVALID', 'DRAFT_SCHEMA_INVALID',
]);

// One shared deadline includes requests and backoff; the caller enforces each
// idle timeout with its AbortController, including response body reads.
export async function requestModelWithRetry({ request, limits, deadline, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  const startedAt = now();
  const retryDeadline = Math.min(deadline, startedAt + Math.min(10, limits.maxModelMinutes) * 60_000);
  const maxAttempts = Math.min(5, Math.max(1, limits.maxModelAttempts));
  const idleMs = Math.min(100, limits.maxModelIdleSeconds) * 1000;
  const failures = [];
  let spentCny = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (now() >= retryDeadline) {
      throw Object.assign(new Error('Model retry window expired'), { code: 'MODEL_TIMEOUT', evidence: { estimatedCny: spentCny, modelAttempts: attempt - 1, modelFailures: failures, modelRetryDurationMs: now() - startedAt } });
    }
    const idleTimeoutMs = Math.min(idleMs, retryDeadline - now());
    log(`model attempt=${attempt}/${maxAttempts} idle_timeout_ms=${idleTimeoutMs} window_remaining_ms=${retryDeadline - now()}`);
    try {
      const result = await request({ attempt, idleTimeoutMs, deadline: retryDeadline, spentCny });
      if (now() > retryDeadline) {
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
      failures.push({ attempt, code: error.code ?? 'CONTENT_GUARDIAN_FAILED', httpStatus: error.evidence?.httpStatus ?? null, transportCode: error.evidence?.transportCode ?? null, validationFailure: error.validationFailure ?? null });
      error.evidence = { ...error.evidence, estimatedCny: spentCny, modelAttempts: attempt, modelFailures: [...failures], modelRetryDurationMs: now() - startedAt };
      const delayMs = Math.min(40_000, 5000 * 2 ** (attempt - 1));
      if (!retryableCodes.has(error.code) || attempt === maxAttempts || now() + delayMs >= retryDeadline) throw error;
      log(`model retry code=${error.code} http_status=${error.evidence.httpStatus ?? 'none'} delay_ms=${delayMs}`);
      await sleep(delayMs);
    }
  }
}
