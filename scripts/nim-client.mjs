export function parseModelDraftOutput(stdout, maxChars = 128_000) {
  const trimmed = String(stdout ?? '').trim();
  if (!trimmed || trimmed.length > maxChars) throw new Error('model final answer is missing or too large');
  const fenced = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  let payload = (fenced?.[1] ?? trimmed).trim();
  if (!payload.startsWith('{') || !payload.endsWith('}')) {
    const start = payload.indexOf('{');
    const end = payload.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('model final answer does not contain a JSON object');
    payload = payload.slice(start, end + 1);
  }
  return JSON.parse(payload);
}

export function normalizeNimUsage(usage) {
  const promptTokens = Number(usage?.prompt_tokens);
  const completionTokens = Number(usage?.completion_tokens);
  if (!Number.isFinite(promptTokens) || promptTokens < 0 || !Number.isFinite(completionTokens) || completionTokens < 0) {
    throw Object.assign(new Error('Model API response did not include enforceable token usage'), { code: 'MODEL_USAGE_MISSING' });
  }
  const reasoningTokens = Number(usage?.completion_tokens_details?.reasoning_tokens ?? 0);
  const cacheReadTokens = Number(usage?.prompt_tokens_details?.cached_tokens ?? 0);
  const normalizedReasoning = Number.isFinite(reasoningTokens) && reasoningTokens > 0 ? Math.min(reasoningTokens, completionTokens) : 0;
  const normalizedCache = Number.isFinite(cacheReadTokens) && cacheReadTokens > 0 ? Math.min(cacheReadTokens, promptTokens) : 0;
  return {
    inputTokens: promptTokens - normalizedCache,
    outputTokens: completionTokens - normalizedReasoning,
    cacheReadTokens: normalizedCache,
    cacheWriteTokens: 0,
    reasoningTokens: normalizedReasoning,
    totalTokens: promptTokens + completionTokens,
  };
}

function rejectUpstreamError(payload) {
  if (!payload?.error && payload?.type !== 'error') return;
  const error = payload.error ?? payload;
  const status = Number(error.status ?? error.status_code ?? payload.status);
  const tag = String(error.code ?? error.type ?? '').toLowerCase();
  let code = 'MODEL_UPSTREAM_ERROR';
  if (Number.isInteger(status) && status >= 400 && status <= 599) code = classifyNimHttpStatus(status);
  else if (/timeout|timed_out/.test(tag)) code = 'MODEL_TIMEOUT';
  else if (/rate_limit|quota_exceeded/.test(tag)) code = 'MODEL_RATE_LIMITED';
  else if (/invalid_api_key|authentication|permission_denied/.test(tag)) code = 'MODEL_AUTH_FAILED';
  else if (/server_error|service_unavailable|overloaded/.test(tag)) code = 'MODEL_SERVICE_FAILED';
  else if (/invalid_request|unsupported|invalid_parameter/.test(tag)) code = 'MODEL_REQUEST_REJECTED';
  throw Object.assign(new Error('Model API returned an upstream error'), { code });
}

export function parseNimCompletion(payload, options = {}) {
  rejectUpstreamError(payload);
  const choice = payload?.choices?.[0];
  if (!choice || typeof choice !== 'object') {
    throw Object.assign(new Error('Model API response did not contain a completion choice'), { code: 'MODEL_PROTOCOL_FAILED' });
  }
  if (choice.finish_reason === 'length') {
    throw Object.assign(new Error('Model API output reached the token cap'), { code: 'MODEL_OUTPUT_TRUNCATED' });
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    throw Object.assign(new Error('Model API returned an unsupported finish reason'), { code: 'MODEL_PROTOCOL_FAILED' });
  }
  const content = choice.message?.content;
  const output = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('')
      : '';
  if (!output.trim()) {
    throw Object.assign(new Error('Model API returned no final text'), { code: 'MODEL_EMPTY_RESPONSE' });
  }
  const usage = payload.usage
    ? normalizeNimUsage(payload.usage)
    : options.allowMissingUsage ? null : normalizeNimUsage(payload.usage);
  return { output, usage };
}

export function parseNimStream(text) {
  const source = String(text ?? '').trim();
  if (source.startsWith('{')) {
    let payload;
    try { payload = JSON.parse(source); }
    catch { throw Object.assign(new Error('Model API returned invalid JSON'), { code: 'MODEL_PROTOCOL_FAILED' }); }
    rejectUpstreamError(payload);
    throw Object.assign(new Error('Model API did not return a completion stream'), { code: 'MODEL_PROTOCOL_FAILED' });
  }
  const chunks = [];
  let usage = null;
  let finishReason = null;
  let returnedModel = null;
  let streamEvents = 0;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let event;
    try { event = JSON.parse(data); }
    catch { throw Object.assign(new Error('Model API stream contained invalid JSON'), { code: 'MODEL_PROTOCOL_FAILED' }); }
    rejectUpstreamError(event);
    streamEvents++;
    if (typeof event.model === 'string' && /^[a-zA-Z0-9./:_-]{1,128}$/.test(event.model) && !/^sk[-_]/i.test(event.model)) returnedModel = event.model;
    if (event.usage) usage = event.usage;
    const choice = event.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const content = choice.delta?.content;
    if (typeof content === 'string') chunks.push(content);
    else if (Array.isArray(content)) {
      chunks.push(content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join(''));
    }
  }
  // A terminal choice is authoritative even when a provider omits [DONE].
  if (!finishReason) {
    throw Object.assign(new Error('Model API stream ended without a terminal choice'), { code: 'MODEL_STREAM_INCOMPLETE' });
  }
  return {
    returnedModel,
    streamEvents,
    choices: [{ finish_reason: finishReason, message: { content: chunks.join('') } }],
    usage,
  };
}

export function classifyNimHttpStatus(status) {
  if (status === 401 || status === 403) return 'MODEL_AUTH_FAILED';
  if (status === 408 || status === 504) return 'MODEL_TIMEOUT';
  if (status === 413) return 'MODEL_CONTEXT_LIMIT';
  if (status === 429) return 'MODEL_RATE_LIMITED';
  return status >= 500 ? 'MODEL_SERVICE_FAILED' : 'MODEL_REQUEST_REJECTED';
}

// Fetch wraps transport failures in TypeError.cause; preserve only known safe codes.
export function classifyModelTransportError(error) {
  const code = error?.cause?.code ?? error?.code;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' ||
      ['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT'].includes(code)) {
    return { code: 'MODEL_TIMEOUT', transportCode: code?.match(/^[A-Z_]+$/)?.[0] ?? error.name };
  }
  if (['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET'].includes(code)) {
    return { code: 'MODEL_NETWORK_FAILED', transportCode: code };
  }
  return null;
}

export function buildModelRequest(model, prompt) {
  if (typeof prompt !== 'string') {
    throw Object.assign(new TypeError('Content synthesis accepts text evidence only'), { code: 'MODEL_TEXT_INPUT_REQUIRED' });
  }
  return {
    model: model.id,
    messages: [
      { role: 'system', content: 'Return only the requested JSON object. Do not include hidden reasoning, Markdown or commentary.' },
      { role: 'user', content: prompt },
    ],
    temperature: model.temperature,
    top_p: model.topP,
    max_tokens: model.maxTokens,
    stream: model.stream,
    reasoning_effort: model.reasoningEffort,
  };
}
