import assert from 'node:assert/strict';
import test from 'node:test';

import { applyVideoAudiencePolicy, canonicalizeUrl, toSiteItem, validateDraft, validateDraftCandidates, validateSiteItem } from '../scripts/content-schema.mjs';
import { estimateCny } from '../scripts/content-budget.mjs';
import { videoContextInternals } from '../scripts/video-context.mjs';
import { classifyNimHttpStatus, normalizeNimUsage, parseModelDraftOutput, parseNimCompletion, parseNimStream } from '../scripts/nim-client.mjs';

function validItem(overrides = {}) {
  return {
    canonicalUrl: 'https://www.youtube.com/watch?v=example123',
    sourceName: 'Black Myth 官方频道',
    platform: 'YOUTUBE',
    publishedAt: '2026-08-24T01:30:00.000Z',
    originalTitle: 'Black Myth Zhong Kui update',
    titleZh: '《黑神话：钟馗》官方更新',
    titleEn: 'Official Black Myth: Zhong Kui Update',
    summaryZh: '官方频道发布新的内容说明，条目仅整理视频中可以直接确认的信息。',
    summaryEn: 'The official channel published an update. This entry only records information that can be confirmed directly from the source.',
    audience: ['en'],
    category: 'official',
    evidenceLevel: 'confirmed',
    durationZh: '03:20',
    durationEn: '03:20',
    thumbnailUrl: 'https://i.ytimg.com/vi/example123/maxresdefault.jpg',
    tagsZh: ['官方', '视频'],
    tagsEn: ['Official', 'Video'],
    links: [{ labelZh: '观看原片', labelEn: 'Watch source', url: 'https://www.youtube.com/watch?v=example123' }],
    evidence: [{ url: 'https://www.youtube.com/watch?v=example123', type: 'official', supportsZh: '官方频道直接发布该视频。', supportsEn: 'The official channel published the video directly.' }],
    valueScore: 95,
    reviewFlags: [],
    ...overrides,
  };
}

test('valid draft becomes a renderable site item', () => {
  const draft = validateDraft({ schema: 1, runDate: '2026-08-24', items: [validItem()] }, { maxItems: 10, now: new Date('2026-08-24T12:00:00Z') });
  const siteItem = toSiteItem(draft.items[0], '2026-08-24T12:00:00Z');
  assert.equal(siteItem.type, 'official');
  assert.equal(siteItem.evidence, 'confirmed');
  assert.equal(siteItem.date, '2026.08.24');
  assert.equal(siteItem.titleEn, 'Official Black Myth: Zhong Kui Update');
  assert.doesNotThrow(() => validateSiteItem(siteItem));
});

test('draft cannot exceed ten items', () => {
  const items = Array.from({ length: 11 }, (_, index) => validItem({ canonicalUrl: `https://example.com/${index}` }));
  assert.throws(() => validateDraft({ schema: 1, runDate: '2026-08-24', items }, { maxItems: 10 }), /at most 10/);
});

test('confirmed content needs official evidence', () => {
  const item = validItem({ evidence: [{ url: 'https://example.com/report', type: 'secondary', supportsZh: '媒体转述了相关消息。', supportsEn: 'A media report repeats the announcement.' }] });
  assert.throws(() => validateDraft({ schema: 1, runDate: '2026-08-24', items: [item] }), /official source/);
});

test('speculation is forced into review', () => {
  const item = validItem({ evidenceLevel: 'speculation', evidence: [{ url: 'https://example.com/video', type: 'primary', supportsZh: '作者提出角色身份猜测。', supportsEn: 'The creator proposes a theory about the character identity.' }] });
  assert.throws(() => validateDraft({ schema: 1, runDate: '2026-08-24', items: [item] }), /review flag/);
});

test('canonical URL removes tracking without breaking image paths', () => {
  assert.equal(canonicalizeUrl('https://example.com/image.jpg?utm_source=test'), 'https://example.com/image.jpg');
  assert.equal(canonicalizeUrl('https://example.com/article'), 'https://example.com/article/');
});

test('cost estimate uses configured CNY rates', () => {
  const amount = estimateCny({ inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 }, {
    inputCacheHit: 0.1, inputCacheMiss: 3, output: 9,
  });
  assert.equal(amount, 3.9);
});

test('video context discovers Bilibili and YouTube references without duplicates', () => {
  const references = videoContextInternals.extractVideoReferences([{
    evidence: 'https://www.bilibili.com/video/BV1Ew8P6pEUE/ https://youtu.be/dgU_qY0segY https://www.youtube.com/watch?v=dgU_qY0segY',
  }]);
  assert.deepEqual(references.map(item => `${item.platform}:${item.id}`), [
    'BILIBILI:BV1Ew8P6pEUE',
    'YOUTUBE:dgU_qY0segY',
  ]);
});

test('video context reads Bilibili subtitle bodies', () => {
  assert.equal(videoContextInternals.subtitleText({ body: [{ content: '第一句' }, { content: '第二句' }] }), '第一句\n第二句');
});

test('non-streaming model final JSON is parsed without granting file writes', () => {
  const draft = parseModelDraftOutput('{"schema":1,"runDate":"2026-08-24","items":[]}');
  assert.deepEqual(draft, { schema: 1, runDate: '2026-08-24', items: [] });
  assert.deepEqual(parseModelDraftOutput('整理结果如下：\n{"schema":1,"items":[]}'), { schema: 1, items: [] });
});

test('one invalid model candidate does not discard valid entries', () => {
  const result = validateDraftCandidates({
    schema: 1,
    runDate: '2026-08-24',
    items: [validItem(), { ...validItem(), canonicalUrl: 'not-a-url' }],
  }, { maxItems: 10, now: new Date('2026-08-24T12:00:00Z') });
  assert.equal(result.draft.items.length, 1);
  assert.equal(result.discardedItems, 1);
});

test('NVIDIA completion and usage are normalized for the budget gate', () => {
  const completion = parseNimCompletion({
    choices: [{ finish_reason: 'stop', message: { content: '{"schema":1,"items":[]}' } }],
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_tokens_details: { cached_tokens: 300 },
      completion_tokens_details: { reasoning_tokens: 40 },
    },
  });
  assert.equal(completion.output, '{"schema":1,"items":[]}');
  assert.deepEqual(completion.usage, {
    inputTokens: 700,
    outputTokens: 160,
    cacheReadTokens: 300,
    cacheWriteTokens: 0,
    reasoningTokens: 40,
    totalTokens: 1200,
  });
  assert.equal(classifyNimHttpStatus(429), 'MODEL_RATE_LIMITED');
  assert.equal(classifyNimHttpStatus(503), 'MODEL_SERVICE_FAILED');
  assert.throws(() => normalizeNimUsage({}), error => error.code === 'MODEL_USAGE_MISSING');
});

test('NVIDIA streaming chunks are assembled with final usage', () => {
  const payload = parseNimStream([
    'data: {"choices":[{"delta":{"content":"{\\"schema\\":"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{"content":"1}"},"finish_reason":"stop"}]}',
    'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":4}}',
    'data: [DONE]',
  ].join('\n'));
  const completion = parseNimCompletion(payload);
  assert.equal(completion.output, '{"schema":1}');
  assert.equal(completion.usage.totalTokens, 16);
});

test('NVIDIA default stream can omit usage and use the configured budget bound', () => {
  const payload = parseNimStream([
    'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ].join('\n'));
  const completion = parseNimCompletion(payload, { allowMissingUsage: true });
  assert.equal(completion.output, '{}');
  assert.equal(completion.usage, null);
});

test('video audience policy keeps primary platforms at two-to-one while allowing crossover', () => {
  const bilibili = [
    validItem({ canonicalUrl: 'https://www.bilibili.com/video/BV1abc/', sourceName: 'B站作者甲', platform: 'BILIBILI', audience: ['zh', 'en'], valueScore: 91 }),
    validItem({ canonicalUrl: 'https://www.bilibili.com/video/BV1def/', sourceName: 'B站作者乙', platform: 'BILIBILI', audience: ['zh', 'en'], valueScore: 90 }),
  ];
  const youtube = [
    validItem({ canonicalUrl: 'https://www.youtube.com/watch?v=creator-one', sourceName: 'Creator One', audience: ['zh', 'en'], valueScore: 89 }),
    validItem({ canonicalUrl: 'https://www.youtube.com/watch?v=creator-two', sourceName: 'Creator Two', audience: ['zh', 'en'], valueScore: 88 }),
  ];
  const normalized = validateDraft({ schema: 1, runDate: '2026-08-24', items: [...bilibili, ...youtube] }, { maxItems: 10 }).items;
  const result = applyVideoAudiencePolicy(normalized, { videoPrimaryToCrossRatio: 2, maxYoutubeItemsPerCreatorPerRun: 1 });
  const zhVideos = result.items.filter(item => item.audience.includes('zh'));
  const enVideos = result.items.filter(item => item.audience.includes('en'));
  assert.equal(zhVideos.filter(item => item.platform === 'BILIBILI').length, 2);
  assert.equal(zhVideos.filter(item => item.platform === 'YOUTUBE').length, 1);
  assert.equal(enVideos.filter(item => item.platform === 'YOUTUBE').length, 2);
  assert.equal(enVideos.filter(item => item.platform === 'BILIBILI').length, 1);
  assert.equal(result.trimmedCrossAudience, 2);
});

test('video audience policy keeps YouTube sources diverse within one run', () => {
  const first = validItem({ canonicalUrl: 'https://www.youtube.com/watch?v=creator-a', sourceName: 'Same Creator', valueScore: 92 });
  const repeated = validItem({ canonicalUrl: 'https://www.youtube.com/watch?v=creator-b', sourceName: ' same  creator ', valueScore: 91 });
  const independent = validItem({ canonicalUrl: 'https://www.youtube.com/watch?v=creator-c', sourceName: 'Independent Creator', valueScore: 90 });
  const normalized = validateDraft({ schema: 1, runDate: '2026-08-24', items: [first, repeated, independent] }, { maxItems: 10 }).items;
  const result = applyVideoAudiencePolicy(normalized, { videoPrimaryToCrossRatio: 2, maxYoutubeItemsPerCreatorPerRun: 1 });
  assert.deepEqual(result.items.map(item => item.sourceName), ['Same Creator', 'Independent Creator']);
  assert.equal(result.discardedCreatorDuplicates, 1);
});
