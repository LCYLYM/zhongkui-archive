import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import { I18nProvider } from './i18n.jsx';
import { sourceItems, dossiers, frameChapters } from './data/content.js';
import { archivePath, parseArchivePath } from './lib/archive.mjs';
const origin = 'https://zk.syal.site';
const sections = { saved:['收藏','Saved'], top:['黑神话：钟馗资料站','Black Myth: Zhong Kui Archive'], stream:['消息与原片','News and Sources'], origins:['官方消息时间线','Official Timeline'], frames:['实机逐帧解析','Gameplay Chapter Notes'], dossiers:['人物志','Character Records'], overseas:['海外回响','Overseas Response'] };
export function routes() {
  return ['/', ...['zh','en'].flatMap(locale => [ ...Object.keys(sections).map(section => archivePath(section,'',locale)), ...dossiers.map(item => archivePath('dossiers',item.id,locale)), ...frameChapters.map(item => archivePath('frames',item.id,locale)), ...sourceItems.map(item => archivePath('source',item.id,locale)) ])];
}
export function render(path) {
  const route = parseArchivePath(path), locale = route.locale, en = locale === 'en';
  const character = route.section === 'dossiers' ? dossiers.find(item => item.id === route.id) : null;
  const chapter = route.section === 'frames' ? frameChapters.find(item => item.id === route.id) : null;
  const source = route.section === 'source' ? sourceItems.find(item => item.id === route.id) : null;
  const label = character ? (en ? character.nameEn : character.name) : chapter ? (en ? chapter.titleEn : chapter.title) : source ? (en ? source.titleEn ?? source.title : source.title) : (sections[route.section] ?? sections.top)[en ? 1 : 0];
  const title = `${label}｜${en ? 'Zhong Kui Archive' : '钟馗志'}`;
  const description = character ? `${en ? character.aliasEn : character.alias}。${(en ? character.factsEn : character.facts).join('；')}` : chapter ? `${chapter.range} · ${(en ? chapter.observedEn : chapter.observed).join('；')}` : source ? (en ? source.summaryEn ?? source.summary : source.summary) : en ? 'An independent, source-linked Black Myth: Zhong Kui archive: official announcements, gameplay notes, character records and creator research.' : '《黑神话：钟馗》民间资料站，收录游戏科学官方消息、实机原片、逐帧解析、人物线索与民俗考据，每条资料附原始出处。';
  const canonical = `${origin}${archivePath(route.section,route.id,locale)}`;
  const image = new URL(source?.image ?? '/assets/media/BV1kS8H6VERt.jpg', origin).href;
  const schema = { '@context':'https://schema.org', '@graph':[
    { '@type':'WebSite', '@id':`${origin}/#website`, name:en ? 'Zhong Kui Archive' : '钟馗志', url:origin, description:en ? 'Independent Black Myth: Zhong Kui reference archive' : '黑神话：钟馗非官方资料站', inLanguage:['zh-CN','en'] },
    { '@type': source || character || chapter ? 'WebPage' : 'CollectionPage', '@id':canonical, url:canonical, name:title, description, inLanguage:en ? 'en' : 'zh-CN', isPartOf:{ '@id':`${origin}/#website` }, ...(source ? { citation:source.links.map(link => link.url) } : {}) },
    { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:en ? 'Archive' : '钟馗志', item:`${origin}${archivePath('top','',locale)}` }, ...(route.section !== 'top' ? [{ '@type':'ListItem', position:2, name:label, item:canonical }] : [])] }
  ] };
  return { noindex:route.section === 'saved', html:renderToString(<I18nProvider initialLanguage={locale}><App initialPath={path} /></I18nProvider>), locale, title, description, canonical, image, schema, alternates:['zh','en'].map(lang => ({lang:lang === 'zh' ? 'zh-CN' : 'en', href:`${origin}${archivePath(route.section,route.id,lang)}`})) };
}
