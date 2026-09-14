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

export function parseNimCompletion(payload, options = {}) {
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
  const chunks = [];
  let usage = null;
  let finishReason = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let event;
    try { event = JSON.parse(data); }
    catch { throw Object.assign(new Error('Model API stream contained invalid JSON'), { code: 'MODEL_PROTOCOL_FAILED' }); }
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
  return {
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
