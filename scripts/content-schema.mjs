import { createHash } from 'node:crypto';

const ITEM_KEYS = new Set([
  'canonicalUrl', 'sourceName', 'platform', 'publishedAt', 'originalTitle', 'titleZh',
  'titleEn', 'summaryZh', 'summaryEn', 'audience', 'category', 'evidenceLevel', 'durationZh', 'durationEn', 'thumbnailUrl', 'tagsZh', 'tagsEn',
  'links', 'evidence', 'valueScore', 'reviewFlags',
]);
const LINK_KEYS = new Set(['labelZh', 'labelEn', 'url']);
const SITE_LINK_KEYS = new Set(['label', 'labelEn', 'url']);
const EVIDENCE_KEYS = new Set(['url', 'type', 'supportsZh', 'supportsEn']);
const PLATFORMS = new Set(['OFFICIAL', 'BILIBILI', 'YOUTUBE', 'ARTICLE', 'NEWS']);
const CATEGORIES = new Set(['official', 'analysis', 'overseas', 'research']);
const EVIDENCE_LEVELS = new Set(['confirmed', 'analysis', 'speculation', 'reaction']);
const EVIDENCE_TYPES = new Set(['official', 'primary', 'secondary']);
const AUDIENCES = new Set(['zh', 'en']);
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'igshid', 'spm_id_from', 'share_source', 'share_medium',
  'share_plat', 'share_session_id', 'share_tag', 'timestamp', 'unique_k',
]);

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(path, `unexpected key ${key}`);
  }
}

function text(value, path, { min = 1, max = 500 } = {}) {
  if (typeof value !== 'string') fail(path, 'must be a string');
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < min || normalized.length > max) fail(path, `length must be ${min}-${max}`);
  return normalized;
}

function stringArray(value, path, { maxItems = 8, itemMax = 40 } = {}) {
  if (!Array.isArray(value) || value.length > maxItems) fail(path, `must be an array with at most ${maxItems} items`);
  return [...new Set(value.map((item, index) => text(item, `${path}[${index}]`, { max: itemMax })))];
}

export function canonicalizeUrl(value, path = 'url') {
  const raw = text(value, path, { max: 2000 });
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(path, 'must be an absolute URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) fail(path, 'must be credential-free HTTPS');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname === 'youtu.be') {
    const videoId = url.pathname.split('/').filter(Boolean)[0];
    if (videoId) return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }
  const lastSegment = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  if (url.pathname !== '/' && !url.search && !url.pathname.endsWith('/') && !lastSegment.includes('.')) url.pathname += '/';
  return url.href;
}

function validateLink(value, path) {
  if (!plainObject(value)) fail(path, 'must be an object');
  exactKeys(value, LINK_KEYS, path);
  return {
    label: text(value.labelZh, `${path}.labelZh`, { max: 32 }),
    labelEn: text(value.labelEn, `${path}.labelEn`, { max: 48 }),
    url: canonicalizeUrl(value.url, `${path}.url`),
  };
}

function validateSiteLink(value, path) {
  if (!plainObject(value)) fail(path, 'must be an object');
  exactKeys(value, SITE_LINK_KEYS, path);
  return {
    label: text(value.label, `${path}.label`, { max: 32 }),
    labelEn: text(value.labelEn, `${path}.labelEn`, { max: 48 }),
    url: canonicalizeUrl(value.url, `${path}.url`),
  };
}

function validateEvidence(value, path) {
  if (!plainObject(value)) fail(path, 'must be an object');
  exactKeys(value, EVIDENCE_KEYS, path);
  const type = text(value.type, `${path}.type`, { max: 20 });
  if (!EVIDENCE_TYPES.has(type)) fail(`${path}.type`, `must be one of ${[...EVIDENCE_TYPES].join(', ')}`);
  return {
    url: canonicalizeUrl(value.url, `${path}.url`),
    type,
    supports: text(value.supportsZh, `${path}.supportsZh`, { min: 6, max: 180 }),
    supportsEn: text(value.supportsEn, `${path}.supportsEn`, { min: 12, max: 260 }),
  };
}

function validatePublishedAt(value, path, now = new Date()) {
  const normalized = text(value, path, { max: 40 });
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) fail(path, 'must be an ISO date-time');
  if (date.getTime() > now.getTime() + 48 * 60 * 60 * 1000) fail(path, 'cannot be more than 48 hours in the future');
  if (date.getTime() < Date.UTC(2025, 0, 1)) fail(path, 'is unexpectedly old for this archive');
  return date.toISOString();
}

export function validateDraft(draft, options = {}) {
  if (!plainObject(draft)) fail('draft', 'must be an object');
  const allowedDraftKeys = new Set(['schema', 'runDate', 'items']);
  exactKeys(draft, allowedDraftKeys, 'draft');
  if (draft.schema !== 1) fail('draft.schema', 'must equal 1');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.runDate)) fail('draft.runDate', 'must use YYYY-MM-DD');
  const maxItems = options.maxItems ?? 10;
  if (!Array.isArray(draft.items) || draft.items.length > maxItems) fail('draft.items', `must contain at most ${maxItems} items`);
  const seen = new Set();
  const items = draft.items.map((value, index) => {
    const path = `draft.items[${index}]`;
    if (!plainObject(value)) fail(path, 'must be an object');
    exactKeys(value, ITEM_KEYS, path);
    const canonicalUrl = canonicalizeUrl(value.canonicalUrl, `${path}.canonicalUrl`);
    if (seen.has(canonicalUrl)) fail(`${path}.canonicalUrl`, 'duplicates another item in this draft');
    seen.add(canonicalUrl);
    const platform = text(value.platform, `${path}.platform`, { max: 20 });
    const category = text(value.category, `${path}.category`, { max: 20 });
    const evidenceLevel = text(value.evidenceLevel, `${path}.evidenceLevel`, { max: 20 });
    if (!PLATFORMS.has(platform)) fail(`${path}.platform`, `must be one of ${[...PLATFORMS].join(', ')}`);
    if (!CATEGORIES.has(category)) fail(`${path}.category`, `must be one of ${[...CATEGORIES].join(', ')}`);
    if (!EVIDENCE_LEVELS.has(evidenceLevel)) fail(`${path}.evidenceLevel`, `must be one of ${[...EVIDENCE_LEVELS].join(', ')}`);
    const links = value.links;
    if (!Array.isArray(links) || links.length < 1 || links.length > 3) fail(`${path}.links`, 'must contain 1-3 links');
    const evidence = value.evidence;
    if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 6) fail(`${path}.evidence`, 'must contain 1-6 evidence records');
    const normalizedEvidence = evidence.map((item, evidenceIndex) => validateEvidence(item, `${path}.evidence[${evidenceIndex}]`));
    const sourceName = text(value.sourceName, `${path}.sourceName`, { max: 80 });
    if (evidenceLevel === 'confirmed' && !normalizedEvidence.some(item => item.type === 'official')) {
      fail(`${path}.evidence`, 'confirmed information needs at least one official source');
    }
    const reviewFlags = stringArray(value.reviewFlags, `${path}.reviewFlags`, { maxItems: 8, itemMax: 80 });
    const audience = stringArray(value.audience, `${path}.audience`, { maxItems: 2, itemMax: 2 });
    if (audience.length === 0 || audience.some(locale => !AUDIENCES.has(locale))) fail(`${path}.audience`, 'must contain zh and/or en');
    if (platform === 'BILIBILI' && (audience.length !== 1 || audience[0] !== 'zh')) fail(`${path}.audience`, 'Bilibili entries are published to zh only');
    if (platform === 'YOUTUBE' && (audience.length !== 1 || audience[0] !== 'en')) fail(`${path}.audience`, 'YouTube entries are published to en only');
    if (evidenceLevel === 'speculation' && reviewFlags.length === 0) {
      fail(`${path}.reviewFlags`, 'speculation must carry a review flag and cannot auto-publish');
    }
    const valueScore = Number(value.valueScore);
    if (!Number.isInteger(valueScore) || valueScore < 0 || valueScore > 100) fail(`${path}.valueScore`, 'must be an integer from 0 to 100');
    let thumbnailUrl = null;
    if (value.thumbnailUrl !== null && value.thumbnailUrl !== undefined && value.thumbnailUrl !== '') {
      thumbnailUrl = canonicalizeUrl(value.thumbnailUrl, `${path}.thumbnailUrl`);
    }
    return {
      canonicalUrl,
      sourceName,
      platform,
      publishedAt: validatePublishedAt(value.publishedAt, `${path}.publishedAt`, options.now),
      originalTitle: text(value.originalTitle, `${path}.originalTitle`, { max: 180 }),
      titleZh: text(value.titleZh, `${path}.titleZh`, { max: 120 }),
      titleEn: text(value.titleEn, `${path}.titleEn`, { max: 180 }),
      summaryZh: text(value.summaryZh, `${path}.summaryZh`, { min: 12, max: 320 }),
      summaryEn: text(value.summaryEn, `${path}.summaryEn`, { min: 24, max: 500 }),
      audience,
      category,
      evidenceLevel,
      durationZh: text(value.durationZh, `${path}.durationZh`, { max: 30 }),
      durationEn: text(value.durationEn, `${path}.durationEn`, { max: 40 }),
      thumbnailUrl,
      tagsZh: stringArray(value.tagsZh, `${path}.tagsZh`, { maxItems: 6, itemMax: 20 }),
      tagsEn: stringArray(value.tagsEn, `${path}.tagsEn`, { maxItems: 6, itemMax: 32 }),
      links: links.map((item, linkIndex) => validateLink(item, `${path}.links[${linkIndex}]`)),
      evidence: normalizedEvidence,
      valueScore,
      reviewFlags,
    };
  });
  return { schema: 1, runDate: draft.runDate, items };
}

function chinaParts(isoDate) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(isoDate)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function itemId(url) {
  return `auto-${createHash('sha256').update(url).digest('hex').slice(0, 14)}`;
}

const PLATFORM_COPY = {
  OFFICIAL: '官方',
  BILIBILI: 'BILIBILI',
  YOUTUBE: 'YOUTUBE',
  ARTICLE: '文章',
  NEWS: '媒体',
};

export function toSiteItem(item, collectedAt = new Date().toISOString()) {
  const parts = chinaParts(item.publishedAt);
  const links = [
    {
      label: item.platform === 'YOUTUBE' ? '观看原片' : item.platform === 'BILIBILI' ? '查看原视频' : '阅读原文',
      labelEn: item.platform === 'ARTICLE' || item.platform === 'NEWS' ? 'Read source' : 'Watch source',
      url: item.canonicalUrl,
    },
    ...item.links.filter(link => link.url !== item.canonicalUrl),
  ].slice(0, 3);
  return {
    id: itemId(item.canonicalUrl),
    type: item.category,
    date: `${parts.year}.${parts.month}.${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    source: item.sourceName,
    platform: PLATFORM_COPY[item.platform],
    platformEn: item.platform === 'ARTICLE' ? 'ARTICLE' : item.platform === 'NEWS' ? 'MEDIA' : item.platform,
    title: item.titleZh,
    titleEn: item.titleEn,
    summary: item.summaryZh,
    summaryEn: item.summaryEn,
    audience: item.audience,
    evidence: item.evidenceLevel,
    duration: item.durationZh,
    durationEn: item.durationEn,
    image: item.thumbnailUrl ?? '/assets/media/official-2026.jpg',
    tags: item.tagsZh,
    tagsEn: item.tagsEn,
    links,
    provenance: {
      canonicalUrl: item.canonicalUrl,
      originalTitle: item.originalTitle,
      publishedAt: item.publishedAt,
      collectedAt,
      valueScore: item.valueScore,
      evidence: item.evidence,
    },
  };
}

export function validateSiteItem(item, path = 'siteItem') {
  if (!plainObject(item)) fail(path, 'must be an object');
  for (const key of ['id', 'type', 'date', 'time', 'source', 'platform', 'title', 'summary', 'evidence', 'duration', 'image']) {
    if (typeof item[key] !== 'string' || item[key].trim() === '') fail(`${path}.${key}`, 'must be a non-empty string');
  }
  for (const key of ['titleEn', 'summaryEn', 'platformEn', 'durationEn']) {
    if (typeof item[key] !== 'string' || item[key].trim() === '') fail(`${path}.${key}`, 'must be a non-empty English string');
  }
  if (!Array.isArray(item.audience) || item.audience.length < 1 || item.audience.some(locale => !AUDIENCES.has(locale))) fail(`${path}.audience`, 'must contain zh and/or en');
  if (!CATEGORIES.has(item.type)) fail(`${path}.type`, 'has an unsupported category');
  if (!EVIDENCE_LEVELS.has(item.evidence)) fail(`${path}.evidence`, 'has an unsupported evidence level');
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(item.date)) fail(`${path}.date`, 'must use YYYY.MM.DD');
  if (!Array.isArray(item.tags) || item.tags.length > 6) fail(`${path}.tags`, 'must contain at most 6 tags');
  if (!Array.isArray(item.tagsEn) || item.tagsEn.length > 6) fail(`${path}.tagsEn`, 'must contain at most 6 English tags');
  if (!Array.isArray(item.links) || item.links.length < 1 || item.links.length > 3) fail(`${path}.links`, 'must contain 1-3 links');
  item.links.forEach((link, index) => validateSiteLink(link, `${path}.links[${index}]`));
  if (!plainObject(item.provenance)) fail(`${path}.provenance`, 'must be an object');
  canonicalizeUrl(item.provenance.canonicalUrl, `${path}.provenance.canonicalUrl`);
  if (!Array.isArray(item.provenance.evidence) || item.provenance.evidence.length < 1) fail(`${path}.provenance.evidence`, 'must not be empty');
  return item;
}
