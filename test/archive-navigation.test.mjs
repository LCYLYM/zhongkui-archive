import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePath, parseArchivePath, searchArchive, makeSearchRecords, chapterLinks } from '../src/lib/archive.mjs';
import { createServer } from 'vite';
let server;
const content = async () => { server ??= await createServer({ server:{middlewareMode:true}, appType:'custom' }); return server.ssrLoadModule('/src/data/content.js'); };
test.after(async () => { await server?.close(); });
test('Deep links preserve language, section and entity', () => {
  assert.deepEqual(parseArchivePath(archivePath('dossiers','grey-haired-elder','en')), {locale:'en',section:'dossiers',id:'grey-haired-elder'});
  assert.equal(parseArchivePath('/zh/frames/%E0%A4%A/').id, '');
});
test('Search finds an elder by Chinese name, English alias, and chapter evidence', async () => {
  const { sourceItems, dossiers, frameChapters } = await content();
  const records = makeSearchRecords({sources:sourceItems,characters:dossiers,chapters:frameChapters}, 'zh');
  assert.equal(searchArchive('灰发老人',records)[0].id,'grey-haired-elder');
  assert.equal(searchArchive('old man',records)[0].id,'grey-haired-elder');
  assert(searchArchive('灰发老人',records).some(item => item.kind === 'chapter' && item.id === 'cave'));
  assert.equal(searchArchive('Hollow',records,'source')[0].id,'yt-hollow');
  assert.equal(searchArchive('灰发老人',records,'source').length,0);
  assert.equal(searchArchive('xxxxxxxxx',records).length,0);
});
test('Every editorial chapter link resolves to an existing character and chapter', async () => {
  const { dossiers, frameChapters } = await content();
  for (const [character, chapters] of Object.entries(chapterLinks)) {
    assert(dossiers.some(item => item.id === character));
    assert(chapters.every(id => frameChapters.some(chapter => chapter.id === id)));
  }
});
