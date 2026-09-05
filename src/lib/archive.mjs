export const sectionSlugs = { top: '', stream: 'news', origins: 'origins', frames: 'frames', dossiers: 'characters', overseas: 'overseas', saved: 'saved', source: 'sources' };
export function archivePath(section = 'top', id = '', locale = 'zh') {
  return `/${locale}/${sectionSlugs[section] ?? ''}${sectionSlugs[section] ? '/' : ''}${id ? `${encodeURIComponent(id)}/` : ''}`;
}
export function parseArchivePath(path = '/') {
  const [, language, slug, rawId] = path.split('/');
  const locale = language === 'en' ? 'en' : 'zh';
  let id = '';
  try { id = decodeURIComponent(rawId ?? ''); } catch { /* Invalid paths resolve to the section index. */ }
  return { locale, section: Object.keys(sectionSlugs).find(key => sectionSlugs[key] === (slug ?? '')) ?? 'top', id };
}

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-—·：:，,.!?？]/g, '');
export function searchArchive(query, records, kind = 'all') {
  const words = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return records.filter(record => kind === 'all' || record.kind === kind).map(record => {
    const title = normalize(record.title + ' ' + (record.titleAlt ?? ''));
    const aliases = normalize((record.aliases ?? []).join(' '));
    const content = normalize(record.text);
    if (!words.length) return { ...record, score: 0 };
    if (!words.every(word => title.includes(word) || aliases.includes(word) || content.includes(word))) return null;
    return { ...record, score: words.reduce((score, word) => score + (title === word ? 100 : title.includes(word) ? 40 : aliases.includes(word) ? 25 : 4), 0) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

// Editorial reading links connect existing notes to chapters; they assert no character identity or affiliation.
export const chapterLinks = {
  'white-swordsman': ['wilderness', 'first-fight', 'fire-beast', 'underwater', 'clam-lord'],
  'grey-haired-elder': ['cave', 'coast'],
  'cloaked-figure': ['first-fight'],
  'black-beast': ['fire-beast'],
  'underwater-woman': ['underwater'],
  'clam-lord': ['clam-lord'],
  'skeleton-musicians': ['montage'],
};

export function makeSearchRecords({ sources, characters, chapters }, locale) {
  const en = locale === 'en';
  return [
    ...characters.map(item => ({ id: item.id, kind: 'character', title: en ? item.nameEn : item.name, titleAlt: en ? item.name : item.nameEn, aliases: item.keywords, text: [...item.facts, ...item.factsEn, ...item.questions, ...item.questionsEn].join(' '), caption: en ? item.aliasEn : item.alias, href: archivePath('dossiers', item.id, locale) })),
    ...chapters.map(item => ({ id: item.id, kind: 'chapter', title: en ? item.titleEn : item.title, titleAlt: en ? item.title : item.titleEn, aliases: [item.time, item.range], text: [...item.observed, ...item.observedEn, ...item.unknown, ...item.unknownEn].join(' '), caption: `${item.range} · ${en ? 'Gameplay notes' : '实机观察'}`, href: archivePath('frames', item.id, locale) })),
    ...sources.map(item => ({ id: item.id, kind: 'source', title: en ? item.titleEn ?? item.title : item.title, titleAlt: en ? item.title : item.titleEn, aliases: [...(item.tags ?? []), ...(item.tagsEn ?? []), item.source], text: `${item.summary} ${item.summaryEn ?? ''}`, caption: `${item.source} · ${item.platform} · ${item.date}`, href: archivePath('source', item.id, locale) })),
  ];
}
