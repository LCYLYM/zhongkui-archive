export function estimateCny(usage, pricing) {
  const input = Number(usage.inputTokens ?? 0) + Number(usage.cacheWriteTokens ?? 0);
  const cache = Number(usage.cacheReadTokens ?? 0);
  const output = Number(usage.outputTokens ?? 0) + Number(usage.reasoningTokens ?? 0);
  return Number(((input * pricing.inputCacheMiss + cache * pricing.inputCacheHit + output * pricing.output) / 1_000_000).toFixed(6));
}
