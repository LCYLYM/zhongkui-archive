import { useMemo, useState } from 'react';
import { dossiers } from '../data/content.js';
import { ArrowIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function Dossiers() {
  const { locale, t } = useI18n();
  const [openId, setOpenId] = useState('white-swordsman');
  const localizedDossiers = useMemo(() => dossiers.map((item) => locale === 'en' ? { ...item, name: item.nameEn, alias: item.aliasEn, facts: item.factsEn, questions: item.questionsEn } : item), [locale]);
  return (
    <section className="section dossier-section" id="dossiers" data-section="dossiers">
      <div className="section-heading">
        <div><h2>{t('dossiers.title')}</h2><p>{t('dossiers.subtitle')}</p></div>
        <p className="section-index">{t('dossiers.index')}</p>
      </div>
      <div className="dossier-list">
        {localizedDossiers.map((item, index) => {
          const open = item.id === openId;
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
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
