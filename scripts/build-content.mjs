import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateSiteItem } from './content-schema.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(await readFile(join(root, '.content-guardian.json'), 'utf8'));
const entriesDirectory = join(root, config.paths.entries);
const generatedPath = join(root, config.paths.generated);
const files = (await readdir(entriesDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
  .map(entry => entry.name)
  .sort();

const items = [];
const ids = new Set();
const urls = new Set();
for (const name of files) {
  const path = join(entriesDirectory, name);
  const document = JSON.parse(await readFile(path, 'utf8'));
  if (document?.schema !== 1 || !Array.isArray(document.items) || document.items.length > config.limits.maxNewItems) {
    throw new Error(`${config.paths.entries}/${name}: invalid entry document`);
  }
  for (const [index, item] of document.items.entries()) {
    validateSiteItem(item, `${config.paths.entries}/${name}.items[${index}]`);
    if (ids.has(item.id)) throw new Error(`${config.paths.entries}/${name}: duplicate id ${item.id}`);
    if (urls.has(item.provenance.canonicalUrl)) throw new Error(`${config.paths.entries}/${name}: duplicate URL ${item.provenance.canonicalUrl}`);
    ids.add(item.id);
    urls.add(item.provenance.canonicalUrl);
    items.push(item);
  }
}

items.sort((left, right) => {
  const dateOrder = `${right.date} ${right.time}`.localeCompare(`${left.date} ${left.time}`, 'zh-CN');
  return dateOrder || Number(right.provenance.valueScore ?? 0) - Number(left.provenance.valueScore ?? 0);
});

await mkdir(dirname(generatedPath), { recursive: true });
const temporaryPath = `${generatedPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(items, null, 2)}\n`);
await rename(temporaryPath, generatedPath);
console.log(`generated ${items.length} automated content items`);
