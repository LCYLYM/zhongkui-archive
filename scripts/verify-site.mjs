import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const base = resolve(import.meta.dirname, '../dist');
async function list(directory) { const entries = await readdir(directory,{withFileTypes:true}); return (await Promise.all(entries.map(entry => entry.isDirectory() ? list(join(directory,entry.name)) : join(directory,entry.name)))).flat(); }
const files = (await list(base)).filter(file => file.endsWith('/index.html'));
const localAssets = new Set();
for (const file of files) {
  const html = await readFile(file,'utf8');
  assert(html.includes('data-rendered="true"'), `${file}: missing rendered content`);
  assert.equal((html.match(/<meta name="description"/g) ?? []).length,1);
  assert.equal((html.match(/<link rel="canonical"/g) ?? []).length,1);
  assert(html.includes('hreflang="zh-CN"') && html.includes('hreflang="en"'));
  assert(html.includes('application/ld+json'));
  for (const [, path] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)/g)) localAssets.add(path);
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert(ogImage && /^https:\/\//.test(ogImage) && !ogImage.includes('zk.syal.sitehttps:'), `${file}: invalid social image URL`);
  for (const [, href] of html.matchAll(/data-archive-link=""[^>]*href="([^"]+)"/g)) {
    assert((await readFile(join(base,href.slice(1),'index.html'),'utf8')).includes('data-rendered'), `${href}: missing static destination`);
  }
}
const elder = await readFile(join(base,'zh/characters/grey-haired-elder/index.html'),'utf8');
assert( elder.includes('在洞窟段落中举火探路') && elder.includes('/zh/frames/cave/'));
const en = await readFile(join(base,'en/characters/grey-haired-elder/index.html'),'utf8');
assert(en.includes('Carries a torch through the cavern') && en.includes('<html lang="en"'));
const source = await readFile(join(base,'zh/sources/official-820/index.html'),'utf8');
assert(source.includes('https://www.bilibili.com/video/BV1kS8H6VERt/') && source.includes('https://www.youtube.com/watch?v=oi2QgPH61JM'));
const sitemap = await readFile(join(base,'sitemap.xml'),'utf8');
assert(!sitemap.includes('/saved/'));
const saved = await readFile(join(base,'zh/saved/index.html'),'utf8');
assert(saved.includes('noindex,follow'));
for (const path of localAssets) assert((await stat(join(base, path.slice(1)))).size > 0, `${path}: missing rendered asset`);
const decodeHtml = html => html.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, token => ({ '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#x27;':"'", '&#39;':"'" }[token]));
const automated = JSON.parse(await readFile(new URL('../src/data/automated-content.json', import.meta.url), 'utf8'));
for (const item of automated) for (const locale of ['zh', 'en']) {
  const path = `/${locale}/sources/${item.id}/`;
  const html = decodeHtml(await readFile(join(base, path.slice(1), 'index.html'), 'utf8'));
  assert(html.includes(locale === 'zh' ? item.title : item.titleEn), `${path}: missing source title`);
  assert(html.includes(locale === 'zh' ? item.summary : item.summaryEn), `${path}: missing source summary`);
  assert(html.includes(item.provenance.canonicalUrl), `${path}: missing original source link`);
  assert(sitemap.includes(path), `${path}: missing sitemap entry`);
}
const model = JSON.parse(await readFile(join(base, 'assets/models/white-swordsman.json'), 'utf8'));
for (const variant of Object.values(model.variants)) assert.equal((await stat(join(base, variant.url.slice(1)))).size, variant.bytes);
console.log(`PASS: ${files.length} static pages, ${automated.length} automated sources in both languages, linked destinations, metadata and ${localAssets.size} local assets.`);
