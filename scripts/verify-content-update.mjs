import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalizeUrl, validateSiteItem } from './content-schema.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(await readFile(join(root, '.content-guardian.json'), 'utf8'));
const checkAll = process.argv.includes('--all');

function changedPaths() {
  const output = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  return output.split('\0').filter(Boolean).map(record => {
    const raw = record.slice(3);
    return raw.includes(' -> ') ? raw.split(' -> ').at(-1) : raw;
  });
}

if (!checkAll) {
  const allowedEntryPrefix = `${config.paths.entries}/`;
  const allowed = path => path === config.paths.state
    || path === config.paths.generated
    || (path.startsWith(allowedEntryPrefix) && path.endsWith('.json'));
  const changed = changedPaths().filter(path => !path.startsWith('.automation/'));
  const blocked = changed.filter(path => !allowed(path));
  if (blocked.length > 0) throw new Error(`protected files changed: ${blocked.join(', ')}`);
  if (changed.length > config.limits.maxChangedFiles) {
    throw new Error(`changed ${changed.length} files; limit is ${config.limits.maxChangedFiles}`);
  }
}

const state = JSON.parse(await readFile(join(root, config.paths.state), 'utf8'));
const stateKeys = new Set(['schema', 'lastInputFingerprint', 'lastStatus', 'lastRunDate', 'blocker', 'seenUrls']);
if (state.schema !== 1) throw new Error('content/state.json: schema must equal 1');
for (const key of Object.keys(state)) {
  if (!stateKeys.has(key)) throw new Error(`content/state.json: unexpected key ${key}`);
}
if (!Array.isArray(state.seenUrls)) throw new Error('content/state.json: seenUrls must be an array');
const normalizedSeen = state.seenUrls.map((url, index) => canonicalizeUrl(url, `content/state.json.seenUrls[${index}]`));
if (new Set(normalizedSeen).size !== normalizedSeen.length) throw new Error('content/state.json: seenUrls contains duplicates');

const entryFiles = (await readdir(join(root, config.paths.entries), { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.json'));
for (const entry of entryFiles) {
  const document = JSON.parse(await readFile(join(root, config.paths.entries, entry.name), 'utf8'));
  if (document.schema !== 1 || !Array.isArray(document.items)) throw new Error(`${entry.name}: invalid entry document`);
  if (document.items.length > config.limits.maxNewItems) throw new Error(`${entry.name}: more than ${config.limits.maxNewItems} items`);
  document.items.forEach((item, index) => validateSiteItem(item, `${entry.name}.items[${index}]`));
}

const generated = JSON.parse(await readFile(join(root, config.paths.generated), 'utf8'));
if (!Array.isArray(generated)) throw new Error(`${config.paths.generated}: must be an array`);
generated.forEach((item, index) => validateSiteItem(item, `${config.paths.generated}[${index}]`));
console.log(`validated ${entryFiles.length} entry files and ${generated.length} generated items`);
