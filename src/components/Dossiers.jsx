import { useMemo, useState } from 'react';
import { dossiers } from '../data/content.js';
import { ArrowIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function Dossiers({ items = [], onOpenItem }) {
  const { locale, t } = useI18n();
  const [openId, setOpenId] = useState('white-swordsman');
  const localizedDossiers = useMemo(() => dossiers.map((item) => locale === 'en' ? { ...item, name: item.nameEn, alias: item.aliasEn, facts: item.factsEn, questions: item.questionsEn } : item), [locale]);
  return (
    <section className="section dossier-section" id="dossiers" data-section="dossiers">
      <div className="section-heading">
        <div><h2>{t('dossiers.title')}</h2><p>{t('dossiers.subtitle')}</p></div>
        <p className="section-index">{t('dossiers.index', { count: dossiers.length })}</p>
      </div>
      <div className="dossier-list">
        {localizedDossiers.map((item, index) => {
          const open = item.id === openId;
          const related = items.filter((source) => {
            if (item.relatedItemIds?.includes(source.id)) return true;
            const text = [source.title, source.titleEn, source.summary, source.summaryEn, ...(source.tags ?? []), ...(source.tagsEn ?? [])].filter(Boolean).join(' ').toLowerCase();
            return item.keywords?.some((keyword) => text.includes(keyword.toLowerCase()));
          }).slice(0, 4);
          return (
            <article className={`dossier ${open ? 'dossier--open' : ''}`} key={item.id}>
              <button className="dossier-summary" onClick={() => setOpenId(open ? '' : item.id)} aria-expanded={open}>
                <span className="dossier-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="dossier-thumb"><img src={item.image} alt="" /></span>
                <span className="dossier-name"><strong>{item.name}</strong><small>{item.alias}</small></span>
                <span className="dossier-count"><b>{t('dossiers.confirmed', { count: String(item.confirmed).padStart(2, '0') })}</b><small>{t('dossiers.pending', { count: String(item.pending).padStart(2, '0') })}</small></span>
                <ArrowIcon direction={open ? 'up' : 'right'} />
              </button>
              {open ? (
                <div className="dossier-body">
                  <div><h3>{t('dossiers.facts')}</h3><ul>{item.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
                  <div><h3>{t('dossiers.questions')}</h3><ul>{item.questions.map((question) => <li key={question}>{question}</li>)}</ul></div>
                  <div className="dossier-sources">
                    <h3>{t('dossiers.sources')}</h3>
                    {related.length ? <div>{related.map((source) => (
                      <button key={source.id} onClick={() => onOpenItem?.(source)}>
                        <span>{source.source} · {source.platform}</span><strong>{source.title}</strong><ArrowIcon />
                      </button>
                    ))}</div> : <p>{t('dossiers.noSources')}</p>}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
