import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
}

async function jsonlFiles(root) {
  const files = [];
  const visit = async directory => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
  };
  await visit(root);
  return files.sort();
}

export async function readDshTelemetry(root) {
  const totals = emptyUsage();
  const lastByStep = new Map();
  const searchCalls = new Set();
  for (const path of await jsonlFiles(root)) {
    for (const line of (await readFile(path, 'utf8')).split('\n')) {
      if (line.trim() === '') continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const toolName = String(event.data?.name ?? '');
      if (event.type === 'tool/call' && (toolName === 'web_search' || toolName === 'mcp__exa__web_search_exa')) {
        searchCalls.add(event.data.callId ?? `${path}:${searchCalls.size}`);
      }
      const usage = event?.type === 'assistant/chunk' && event.data?.chunk?.type === 'usage'
        ? event.data.chunk.usage
        : event?.type === 'assistant/message' ? event.data?.usage : undefined;
      if (!usage || !Number.isInteger(event.data?.turn) || !Number.isInteger(event.data?.step)) continue;
      const key = `${path}:${event.data.turn}:${event.data.step}`;
      const previous = lastByStep.get(key) ?? emptyUsage();
      const current = Object.fromEntries(Object.keys(totals).map(field => [field, Number(usage[field] ?? 0)]));
      for (const field of Object.keys(totals)) totals[field] += current[field] - previous[field];
      lastByStep.set(key, current);
    }
  }
  return {
    usage: { ...totals, totalTokens: Object.values(totals).reduce((sum, value) => sum + value, 0) },
    searches: searchCalls.size,
  };
}

export function estimateCny(usage, pricing) {
  const input = Number(usage.inputTokens ?? 0) + Number(usage.cacheWriteTokens ?? 0);
  const cache = Number(usage.cacheReadTokens ?? 0);
  const output = Number(usage.outputTokens ?? 0) + Number(usage.reasoningTokens ?? 0);
  return Number(((input * pricing.inputCacheMiss + cache * pricing.inputCacheHit + output * pricing.output) / 1_000_000).toFixed(6));
}
