const USER_AGENT = 'Mozilla/5.0 (compatible; ZhongKuiArchive/1.0; +https://github.com/LCYLYM/zhongkui-archive)';

async function fetchText(url, { deadline, maxBytes = 4_000_000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(30_000, Math.max(1, deadline - Date.now())));
  try {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) return '';
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error('response too large');
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timer);
  }
}

function findJsonArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf('[', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '[') depth += 1;
    else if (character === ']' && --depth === 0) {
      try { return JSON.parse(source.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function extractVideoReferences(results) {
  const found = [];
  const seen = new Set();
  const add = (platform, id, url) => {
    const key = `${platform}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ platform, id, url });
  };
  for (const result of results) {
    const text = result.evidence ?? '';
    for (const match of text.matchAll(/https:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]+)/g)) {
      add('BILIBILI', match[1], `https://www.bilibili.com/video/${match[1]}/`);
    }
    for (const match of text.matchAll(/https:\/\/(?:www\.)?youtube\.com\/watch\?[^\s<>"]*?v=([0-9A-Za-z_-]{11})/g)) {
      add('YOUTUBE', match[1], `https://www.youtube.com/watch?v=${match[1]}`);
    }
    for (const match of text.matchAll(/https:\/\/youtu\.be\/([0-9A-Za-z_-]{11})/g)) {
      add('YOUTUBE', match[1], `https://www.youtube.com/watch?v=${match[1]}`);
    }
  }
  return found;
}

function subtitleText(payload) {
  if (Array.isArray(payload?.body)) {
    return payload.body.map(row => String(row.content ?? '').trim()).filter(Boolean).join('\n');
  }
  if (Array.isArray(payload?.events)) {
    return payload.events.flatMap(event => event.segs ?? []).map(segment => String(segment.utf8 ?? '').trim()).filter(Boolean).join(' ');
  }
  return '';
}

async function bilibiliContext(reference, deadline, maxTranscriptChars) {
  const metadata = JSON.parse(await fetchText(`https://api.bilibili.com/x/web-interface/view?bvid=${reference.id}`, {
    deadline,
    headers: { referer: reference.url },
  }));
  if (metadata.code !== 0 || !metadata.data?.cid) throw new Error('Bilibili metadata unavailable');
  const player = JSON.parse(await fetchText(`https://api.bilibili.com/x/player/v2?bvid=${reference.id}&cid=${metadata.data.cid}`, {
    deadline,
    headers: { referer: reference.url },
  }));
  const tracks = player.data?.subtitle?.subtitles ?? [];
  let transcript = '';
  let transcriptLanguage = null;
  for (const track of tracks.slice(0, 2)) {
    if (!track.subtitle_url) continue;
    const subtitleUrl = track.subtitle_url.startsWith('//') ? `https:${track.subtitle_url}` : track.subtitle_url;
    const parsed = JSON.parse(await fetchText(subtitleUrl, { deadline, maxBytes: 2_000_000, headers: { referer: reference.url } }));
    const text = subtitleText(parsed);
    if (text.length > transcript.length) {
      transcript = text;
      transcriptLanguage = track.lan_doc ?? track.lan ?? null;
    }
  }
  return {
    platform: 'BILIBILI',
    audience: ['zh'],
    url: reference.url,
    title: metadata.data.title,
    author: metadata.data.owner?.name ?? null,
    publishedAt: Number.isFinite(metadata.data.pubdate) ? new Date(metadata.data.pubdate * 1000).toISOString() : null,
    durationSeconds: metadata.data.duration ?? null,
    description: String(metadata.data.desc ?? '').slice(0, 2_000),
    transcriptStatus: transcript ? 'available' : player.data?.need_login_subtitle ? 'login_required' : 'not_provided',
    transcriptLanguage,
    transcript: transcript.slice(0, maxTranscriptChars),
  };
}

async function youtubeContext(reference, deadline, maxTranscriptChars) {
  const metadata = JSON.parse(await fetchText(`https://www.youtube.com/oembed?url=${encodeURIComponent(reference.url)}&format=json`, { deadline }));
  const page = await fetchText(`${reference.url}&hl=en`, { deadline });
  const tracks = findJsonArray(page, '"captionTracks":') ?? [];
  const preferredTrack = tracks.find(track => track.languageCode === 'en') ?? tracks.find(track => track.languageCode?.startsWith('zh')) ?? tracks[0];
  let transcript = '';
  const poTokenRequired = preferredTrack?.baseUrl && new URL(preferredTrack.baseUrl).searchParams.get('exp') === 'xpe';
  let transcriptStatus = poTokenRequired ? 'po_token_required' : preferredTrack ? 'advertised_unavailable' : 'not_provided';
  if (preferredTrack?.baseUrl && !poTokenRequired) {
    try {
      const separator = preferredTrack.baseUrl.includes('?') ? '&' : '?';
      const payloadText = await fetchText(`${preferredTrack.baseUrl}${separator}fmt=json3`, { deadline, maxBytes: 2_000_000 });
      if (payloadText) transcript = subtitleText(JSON.parse(payloadText));
      if (transcript) transcriptStatus = 'available';
    } catch {
      transcriptStatus = 'advertised_unavailable';
    }
  }
  const publishDate = page.match(/"publishDate":"(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
  const description = page.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  let normalizedDescription = '';
  if (description) {
    try { normalizedDescription = JSON.parse(`"${description}"`); } catch {}
  }
  return {
    platform: 'YOUTUBE',
    audience: ['en'],
    url: reference.url,
    title: metadata.title,
    author: metadata.author_name,
    publishedAt: publishDate ? new Date(`${publishDate}T00:00:00Z`).toISOString() : null,
    durationSeconds: null,
    description: normalizedDescription.slice(0, 2_000),
    transcriptStatus,
    transcriptLanguage: preferredTrack?.languageCode ?? null,
    transcript: transcript.slice(0, maxTranscriptChars),
  };
}

export async function collectVideoContexts(results, {
  deadline,
  maxVideos = 12,
  maxTranscriptChars = 24_000,
} = {}) {
  const references = extractVideoReferences(results)
    .sort((left, right) => Number(right.platform === 'BILIBILI') - Number(left.platform === 'BILIBILI'))
    .slice(0, maxVideos);
  const contexts = [];
  for (const reference of references) {
    if (Date.now() >= deadline) break;
    try {
      const context = reference.platform === 'BILIBILI'
        ? await bilibiliContext(reference, deadline, maxTranscriptChars)
        : await youtubeContext(reference, deadline, maxTranscriptChars);
      contexts.push(context);
    } catch {
      contexts.push({
        platform: reference.platform,
        audience: reference.platform === 'BILIBILI' ? ['zh'] : ['en'],
        url: reference.url,
        transcriptStatus: 'unavailable',
      });
    }
  }
  return contexts;
}

export const videoContextInternals = { extractVideoReferences, findJsonArray, subtitleText };
