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
