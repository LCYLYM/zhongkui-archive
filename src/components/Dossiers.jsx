import { dossiers, frameChapters } from '../data/content.js';
import { archivePath, chapterLinks } from '../lib/archive.mjs';
import { ArrowIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';
import CharacterStory from './CharacterStory.jsx';
export default function Dossiers({ items = [], selectedId, onSelect, onOpenItem }) {
  const { locale, t } = useI18n(); const en = locale === 'en';
  const raw = dossiers.find(item => item.id === selectedId) ?? dossiers[0];
  const item = en ? { ...raw, name: raw.nameEn, alias: raw.aliasEn, facts: raw.factsEn, questions: raw.questionsEn } : raw;
  const related = items.filter(source => item.relatedItemIds?.includes(source.id));
  const chapters = frameChapters.filter(chapter => chapterLinks[item.id]?.includes(chapter.id));
  return <section className="section dossier-section" id="dossiers">
    <div className="section-heading"><div><h1>{t('dossiers.title')}</h1><p>{t('dossiers.subtitle')}</p></div><p className="section-index">{dossiers.length} {en ? 'CHARACTER RECORDS' : '份人物记录'}</p></div>
    <div className="character-layout">
      <nav className="character-index" aria-label={en ? 'Character index' : '人物目录'}>{dossiers.map(character => <a data-archive-link href={archivePath('dossiers', character.id, locale)} aria-current={character.id === item.id ? 'page' : undefined} key={character.id}><strong>{en ? character.nameEn : character.name}</strong><small>{en ? character.aliasEn : character.alias}</small></a>)}</nav>
      <article className="character-record" key={item.id}>
        <header className="character-heading"><div><span>{en ? 'CHARACTER FILE' : '人物志 · 形迹'}</span><h2>{item.name}</h2><p>{item.alias}</p></div><div className="character-tallies"><span>{item.facts.length}<small>{en ? 'records' : '条记录'}</small></span><span>{item.questions.length}<small>{en ? 'open questions' : '项待考'}</small></span></div></header>
        {item.id === 'white-swordsman' && <CharacterStory compact />}
        <div className="character-notes"><div><h3>{en ? 'Recorded details' : '已录线索'}</h3><ul>{item.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></div><div><h3>{t('dossiers.questions')}</h3><ul>{item.questions.map(question => <li key={question}>{question}</li>)}</ul></div></div>
        <div className="evidence-trail"><div className="evidence-trail-heading"><h3>{en ? 'Back to the footage' : '循迹回看'}</h3><p>{en ? 'Chapter links follow the archive notes. Open the original to check the observation.' : '按站内观察记录关联章节，打开原片可进一步核对。'}</p></div><div className="evidence-trail-rail">{chapters.map(chapter => <a data-archive-link href={archivePath('frames', chapter.id, locale)} key={chapter.id}><time>{chapter.time}</time><i /><strong>{en ? chapter.titleEn : chapter.title}</strong><small>{chapter.range}<ArrowIcon /></small></a>)}</div></div>
        <div className="character-sources"><h3>{t('dossiers.sources')}</h3>{related.map(source => <button onClick={() => onOpenItem(source)} key={source.id}><span>{source.source}</span><strong>{source.title}</strong><ArrowIcon /></button>)}</div>
      </article>
    </div>
  </section>;
}
