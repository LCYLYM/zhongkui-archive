import { parseModelDraftOutput } from './nim-client.mjs';
import { validateDraftCandidates } from './content-schema.mjs';

export function validateModelDraftOutput(output, { runDate, maxItems }) {
  let raw;
  try { raw = parseModelDraftOutput(output); }
  catch { throw Object.assign(new Error('Model final text is not a valid JSON draft'), { code: 'DRAFT_OUTPUT_INVALID' }); }
  let result;
  try { result = validateDraftCandidates(raw, { maxItems }); }
  catch {
    const failure = raw?.schema !== 1 || !Array.isArray(raw?.items) || raw.items.length > maxItems ||
      !/^\d{4}-\d{2}-\d{2}$/.test(raw?.runDate ?? '') ||
      Object.keys(raw).some(key => !['schema', 'runDate', 'items'].includes(key))
      ? 'TOP_LEVEL_SCHEMA' : 'CANDIDATES_REJECTED';
    throw Object.assign(new Error('Model draft failed its content contract'), { code: 'DRAFT_SCHEMA_INVALID', validationFailure: failure });
  }
  if (result.draft.runDate !== runDate) {
    throw Object.assign(new Error('Model draft date does not match this run'), { code: 'DRAFT_SCHEMA_INVALID', validationFailure: 'RUN_DATE_MISMATCH' });
  }
  return result;
}
