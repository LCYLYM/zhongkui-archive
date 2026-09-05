import { useMemo } from 'react';
import { frameChapters, dossiers } from '../data/content.js';
import { archivePath, chapterLinks } from '../lib/archive.mjs';
import { ArrowIcon, PlayIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function FrameArchive({ onPlayAt, selectedId, onSelect }) {
  const { locale, t } = useI18n();
  const chapters = useMemo(() => frameChapters.map((item) => locale === 'en' ? { ...item, title: item.titleEn, observed: item.observedEn, unknown: item.unknownEn } : item), [locale]);
  const selected = useMemo(() => chapters.find((item) => item.id === selectedId) ?? chapters[0], [chapters, selectedId]);

  return (
    <section className="section frame-section" id="frames" data-section="frames">
      <div className="section-heading">
        <div><h1>{t('frames.title')}</h1><p>{t('frames.subtitle')}</p></div>
        <p className="section-index">{t('frames.index')}</p>
      </div>
      <nav className="chapter-scroller" aria-label={t('frames.tabs')}>
        {chapters.map((chapter, index) => (
          <a key={chapter.id} data-archive-link href={archivePath('frames', chapter.id, locale)} aria-current={chapter.id === selectedId ? 'page' : undefined} className={chapter.id === selectedId ? 'active' : ''}>
            <time>{chapter.time}</time><strong>{chapter.title}</strong><i /><small>{t('frames.chapter', { count: index + 1 })}</small>
          </a>
        ))}
      </nav>
      <div className="frame-detail" key={selected.id}>
        <button className="frame-media" onClick={() => onPlayAt(selected.seconds)} aria-label={t('frames.playLabel', { time: selected.time })}>
          <img src="/assets/official/swordsman-cover.png" alt={t('frames.coverAlt')} /><span className="frame-cover-label">{locale === 'zh' ? '官方封面 · 点击回看本章原片' : 'Official cover · Play this chapter'}</span>
          <span className="frame-play"><PlayIcon /><b>{t('frames.locate', { time: selected.time })}</b></span>
          <span className="frame-scrub"><i style={{ width: `${Math.min(100, (selected.seconds / 952) * 100)}%` }} /></span>
        </button>
        <div className="frame-notes"><h2 className="chapter-title"><small>{selected.time}</small>{selected.title}</h2>
          <div className="frame-note frame-note--observed">
            <header><span>{locale === 'zh' ? '画面观察记录' : 'Recorded observations'}</span><time>{selected.range}</time></header>
            <ul>{selected.observed.map((text) => <li key={text}><i>{t('evidence.analysis.mark')}</i><span>{text}</span></li>)}</ul>
          </div>
          <div className="frame-note frame-note--unknown">
            <header><span>{t('frames.unknown')}</span><small>{t('frames.moreEvidence')}</small></header>
            <ul>{selected.unknown.map((text) => <li key={text}><i>{t('evidence.speculation.mark')}</i><span>{text}</span></li>)}</ul>
          </div>
          <button className="text-button" onClick={() => onPlayAt(selected.seconds)}>{t('frames.judge')} <ArrowIcon /></button>
        </div>
      </div>
      <div className="chapter-related"><span>{locale === 'zh' ? '循此线索，查看人物' : 'Follow these character records'}</span>{dossiers.filter(item => chapterLinks[item.id]?.includes(selected.id)).map(item => <a data-archive-link href={archivePath('dossiers', item.id, locale)} key={item.id}>{locale === 'zh' ? item.name : item.nameEn}<ArrowIcon /></a>)}</div>
    </section>
  );
}
