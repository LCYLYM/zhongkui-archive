const DSH_FAILURE_LINE = /dsh:\s*([A-Z][A-Z0-9_]+):\s*([^\r\n]*)/i;

export function parseDshDraftOutput(stdout, maxChars = 128_000) {
  const trimmed = String(stdout ?? '').trim();
  if (!trimmed || trimmed.length > maxChars) throw new Error('DSH final answer is missing or too large');
  const fenced = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  const payload = (fenced?.[1] ?? trimmed).trim();
  if (!payload.startsWith('{') || !payload.endsWith('}')) {
    throw new Error('DSH final answer must contain JSON only');
  }
  return JSON.parse(payload);
}

export function extractDshFailureCode(stdout, stderr) {
  return `${stdout ?? ''}\n${stderr ?? ''}`.match(DSH_FAILURE_LINE)?.[1]?.toUpperCase() ?? null;
}

export function classifyDshFailure(stdout, stderr) {
  const message = `${stdout ?? ''}\n${stderr ?? ''}`;
  const providerCode = extractDshFailureCode(stdout, stderr);
  if (providerCode === 'LLM_STREAM_IDLE_TIMEOUT' || providerCode === 'TIMEOUT' || /timed?\s*out|timeout/i.test(message)) return 'MODEL_TIMEOUT';
  if (providerCode === 'RATE_LIMITED' || /\b429\b|rate.?limit|too many requests/i.test(message)) return 'MODEL_RATE_LIMITED';
  if (providerCode === 'UNAUTHORIZED' || /\b401\b|unauthori[sz]ed|invalid api key|authentication/i.test(message)) return 'MODEL_AUTH_FAILED';
  if (providerCode === 'CONTEXT_LENGTH_EXCEEDED' || /\b413\b|context.{0,20}(?:length|limit)|request.{0,20}too large|payload too large/i.test(message)) return 'MODEL_CONTEXT_LIMIT';
  if (/EACCES|permission denied|read.?only file system/i.test(message)) return 'DSH_PERMISSION_FAILED';
  if (/max(?:imum)?\s+(?:steps|turns)|step limit/i.test(message)) return 'DSH_STEP_LIMIT';
  if (providerCode) return 'DSH_PROVIDER_FAILED';
  return 'DSH_RUN_FAILED';
}
