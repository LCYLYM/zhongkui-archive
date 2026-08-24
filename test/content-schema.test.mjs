import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalizeUrl, toSiteItem, validateDraft, validateSiteItem } from '../scripts/content-schema.mjs';
import { estimateCny } from '../scripts/content-budget.mjs';

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
