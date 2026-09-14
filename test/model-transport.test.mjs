import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModelRequest, classifyModelTransportError, parseNimCompletion, parseNimStream } from '../scripts/nim-client.mjs';

test('nested fetch timeouts and dropped connections receive retryable classifications', () => {
  const timeout = new TypeError('fetch failed', { cause: Object.assign(new Error('headers timed out'), { code: 'UND_ERR_HEADERS_TIMEOUT' }) });
  assert.deepEqual(classifyModelTransportError(timeout), { code: 'MODEL_TIMEOUT', transportCode: 'UND_ERR_HEADERS_TIMEOUT' });
  const dropped = new TypeError('terminated', { cause: Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' }) });
  assert.deepEqual(classifyModelTransportError(dropped), { code: 'MODEL_NETWORK_FAILED', transportCode: 'UND_ERR_SOCKET' });
  assert.equal(classifyModelTransportError(new SyntaxError('bad JSON')), null);
});

test('configured Qwen effort is transmitted without disabling thinking', () => {
  const request = buildModelRequest({ id: 'qwen3.8-flash', reasoningEffort: 'max', stream: true, maxTokens: 16384 }, 'evidence');
  assert.equal(request.reasoning_effort, 'max');
  assert.equal(request.model, 'qwen3.8-flash');
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
