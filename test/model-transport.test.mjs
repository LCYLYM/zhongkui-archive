import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModelRequest, classifyModelTransportError, parseNimCompletion, parseNimStream } from '../scripts/nim-client.mjs';

test('nested fetch timeouts and dropped connections receive retryable classifications', () => {
  const timeout = new TypeError('fetch failed', { cause: Object.assign(new Error('headers timed out'), { code: 'UND_ERR_HEADERS_TIMEOUT' }) });
  assert.deepEqual(classifyModelTransportError(timeout), { code: 'MODEL_TIMEOUT', transportCode: 'UND_ERR_HEADERS_TIMEOUT' });
  const dropped = new TypeError('terminated', { cause: Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' }) });
  assert.deepEqual(classifyModelTransportError(dropped), { code: 'MODEL_NETWORK_FAILED', transportCode: 'UND_ERR_SOCKET' });
  assert.equal(classifyModelTransportError(new SyntaxError('bad JSON')), null);
});

test('production auto configuration sends high effort and text evidence only', () => {
  const config = JSON.parse(readFileSync(new URL('../.content-guardian.json', import.meta.url)));
  const request = buildModelRequest(config.model, 'evidence');
  assert.equal(request.reasoning_effort, 'high');
  assert.equal(request.model, 'auto');
  assert.equal(request.stream, true);
  assert.ok(request.messages.every(message => typeof message.content === 'string'));
  assert.throws(() => buildModelRequest(config.model, [{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }]), { code: 'MODEL_TEXT_INPUT_REQUIRED' });
  assert.equal(request.chat_template_kwargs, undefined);
  assert.equal(request.messages[1].content, 'evidence');
});

test('thinking stream exposes only final JSON to the content validator', () => {
  const payload = parseNimStream([
    'data: {"choices":[{"delta":{"reasoning_content":"unpublished reasoning"}}]}',
    'data: {"choices":[{"delta":{"content":"{\\"items\\":[]}"},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ].join('\n'));
  const completion = parseNimCompletion(payload, { allowMissingUsage: true });
  assert.equal(completion.output, '{"items":[]}');
  assert.equal(completion.usage, null);
});

test('HTTP 200 error envelopes retain their classification and hide upstream messages', () => {
  for (const [error, code] of [
    [{ code: 'upstream_timeout', message: 'private diagnostic text' }, 'MODEL_TIMEOUT'],
    [{ code: 'rate_limit_exceeded' }, 'MODEL_RATE_LIMITED'],
    [{ code: 'invalid_api_key' }, 'MODEL_AUTH_FAILED'],
    [{ code: 'invalid_request_error' }, 'MODEL_REQUEST_REJECTED'],
    [{ status: 503 }, 'MODEL_SERVICE_FAILED'],
    [{ code: 'unknown_error' }, 'MODEL_UPSTREAM_ERROR'],
  ]) {
    const payload = { error };
    for (const invoke of [
      () => parseNimStream(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n`),
      () => parseNimStream(JSON.stringify(payload)),
      () => parseNimCompletion(payload),
    ]) {
      assert.throws(invoke, e => e.code === code && !e.message.includes('private diagnostic text'));
    }
  }
});

test('partial JSON is rejected without a terminal choice, including a premature DONE', () => {
  const partial = 'data: {"choices":[{"delta":{"content":"{\\"items\\":[]}"}}]}\n';
  for (const text of [partial, `${partial}data: [DONE]\n`]) {
    assert.throws(() => parseNimStream(text), { code: 'MODEL_STREAM_INCOMPLETE' });
  }
});

test('a terminal choice is complete even when DONE is omitted; length remains rejected', () => {
  const stream = reason => `data: ${JSON.stringify({ model: 'DeepSeek-V4.1-Flash', choices: [{ delta: { content: '{}' }, finish_reason: reason }] })}\n`;
  const payload = parseNimStream(stream('stop'));
  assert.equal(parseNimCompletion(payload, { allowMissingUsage: true }).output, '{}');
  assert.equal(payload.returnedModel, 'DeepSeek-V4.1-Flash');
  assert.equal(payload.streamEvents, 1);
  assert.throws(() => parseNimCompletion(parseNimStream(stream('length')), { allowMissingUsage: true }), { code: 'MODEL_OUTPUT_TRUNCATED' });
});


test('native AbortController errors with numeric DOMException codes remain retryable', () => {
  for (const name of ['AbortError', 'TimeoutError']) {
    const native = new DOMException('synthetic deadline', name);
    assert.equal(typeof native.code, 'number');
    assert.deepEqual(classifyModelTransportError(native), { code: 'MODEL_TIMEOUT', transportCode: name });
    const wrapped = new TypeError('fetch failed', { cause: native });
    // Native fetch normally throws the DOMException directly; preserve a wrapped
    // numeric-code cause without crashing, even if it has no known classification.
    assert.equal(classifyModelTransportError(wrapped), null);
  }
});
