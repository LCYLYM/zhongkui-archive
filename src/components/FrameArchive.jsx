import { useMemo, useState } from 'react';
import { frameChapters } from '../data/content.js';
import { ArrowIcon, PlayIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function FrameArchive({ onPlayAt }) {
  const { locale, t } = useI18n();
  const [selectedId, setSelectedId] = useState('clam-lord');
  const chapters = useMemo(() => frameChapters.map((item) => locale === 'en' ? { ...item, title: item.titleEn, observed: item.observedEn, unknown: item.unknownEn } : item), [locale]);
  const selected = useMemo(() => chapters.find((item) => item.id === selectedId) ?? chapters[0], [chapters, selectedId]);

  return (
    <section className="section frame-section" id="frames" data-section="frames">
      <div className="section-heading">
        <div><h2>{t('frames.title')}</h2><p>{t('frames.subtitle')}</p></div>
        <p className="section-index">{t('frames.index')}</p>
      </div>
      <div className="chapter-scroller" role="tablist" aria-label={t('frames.tabs')}>
        {chapters.map((chapter, index) => (
          <button key={chapter.id} role="tab" aria-selected={chapter.id === selectedId} className={chapter.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(chapter.id)}>
            <time>{chapter.time}</time><strong>{chapter.title}</strong><i /><small>{t('frames.chapter', { count: index + 1 })}</small>
          </button>
        ))}
      </div>
      <div className="frame-detail">
        <button className="frame-media" onClick={() => onPlayAt(selected.seconds)} aria-label={t('frames.playLabel', { time: selected.time })}>
          <img src="/assets/media/official-2026.jpg" alt={t('frames.coverAlt')} />
          <span className="frame-play"><PlayIcon /><b>{t('frames.locate', { time: selected.time })}</b></span>
          <span className="frame-scrub"><i style={{ width: `${Math.min(100, (selected.seconds / 952) * 100)}%` }} /></span>
        </button>
        <div className="frame-notes">
          <div className="frame-note frame-note--observed">
            <header><span>{t('frames.observed')}</span><time>{selected.range}</time></header>
            <ul>{selected.observed.map((text) => <li key={text}><i>{t('evidence.analysis.mark')}</i><span>{text}</span></li>)}</ul>
          </div>
          <div className="frame-note frame-note--unknown">
            <header><span>{t('frames.unknown')}</span><small>{t('frames.moreEvidence')}</small></header>
            <ul>{selected.unknown.map((text) => <li key={text}><i>{t('evidence.speculation.mark')}</i><span>{text}</span></li>)}</ul>
          </div>
          <button className="text-button" onClick={() => onPlayAt(selected.seconds)}>{t('frames.judge')} <ArrowIcon /></button>
        </div>
      </div>
    </section>
  );
}
