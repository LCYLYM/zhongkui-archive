import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { ArrowIcon, CloseIcon, SearchIcon } from './Icons.jsx';

function useCloseOnEscape(onClose) {
  useEffect(() => {
    const handler = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}

export function VideoOverlay({ seconds = 0, onClose }) {
  const { t } = useI18n();
  useCloseOnEscape(onClose);
  useEffect(() => {
    document.body.classList.add('overlay-open');
    return () => document.body.classList.remove('overlay-open');
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('video.label')} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="video-dialog">
        <header><div><small>{t('video.kicker')}</small><h2>{t('video.title')}</h2></div><button className="icon-button" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button></header>
        <div className="video-embed"><iframe src={`https://www.youtube-nocookie.com/embed/oi2QgPH61JM?autoplay=1&start=${seconds}`} title={t('video.title')} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
        <footer><span>{t('video.note')}</span><a href="https://www.bilibili.com/video/BV1kS8H6VERt/" target="_blank" rel="noreferrer">{t('video.bilibili')} <ArrowIcon /></a></footer>
      </div>
    </div>
  );
}

export function ItemOverlay({ item, onClose, saved, onToggleSaved }) {
  const { t } = useI18n();
  useCloseOnEscape(onClose);
  const evidenceKind = ['confirmed', 'analysis', 'speculation', 'reaction'].includes(item.evidence) ? item.evidence : 'analysis';
  const evidence = { mark: t(`evidence.${evidenceKind}.mark`), label: t(`evidence.${evidenceKind}.label`) };
  useEffect(() => {
    document.body.classList.add('overlay-open');
    return () => document.body.classList.remove('overlay-open');
  }, []);
  return (
    <div className="overlay overlay--item" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="item-dialog">
        <button className="icon-button item-close" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button>
        <div className="item-dialog-image"><img src={item.image} alt="" /></div>
        <div className="item-dialog-body">
          <p className={`evidence evidence--${item.evidence}`}><i>{evidence.mark}</i>{evidence.label}</p>
          <small>{item.source} · {item.date} · {item.platform}</small>
          <h2 id="item-title">{item.title}</h2>
          <p>{item.summary}</p>
          <div className="tag-line">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <div className="item-actions">
            {item.links.map((link, index) => <a className={index === 0 ? 'button button--red' : 'button button--line'} href={link.url} target="_blank" rel="noreferrer" key={link.url}>{link.label}<ArrowIcon /></a>)}
            <button className="text-button" onClick={() => onToggleSaved(item.id)}>{saved ? t('item.remove') : t('item.save')}</button>
          </div>
        </div>
      </article>
    </div>
  );
}

export function SearchOverlay({ items, onClose, onOpenItem }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  useCloseOnEscape(onClose);
  useEffect(() => {
    document.body.classList.add('overlay-open');
    return () => document.body.classList.remove('overlay-open');
  }, []);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items.slice(0, 7);
    return items.filter((item) => [item.title, item.source, item.summary, ...item.tags].join(' ').toLowerCase().includes(normalized));
  }, [items, query]);
  return (
    <div className="overlay overlay--search" role="dialog" aria-modal="true" aria-label={t('search.label')}>
      <div className="search-dialog">
        <header><SearchIcon /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.inputLabel')} /><button className="icon-button" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button></header>
        <p className="search-count">{query ? t('search.found', { count: results.length }) : t('search.recent')}</p>
        <div className="search-results">
          {results.map((item) => (
            <button key={item.id} onClick={() => onOpenItem(item)}><span>{item.source}</span><strong>{item.title}</strong><small>{item.date}<ArrowIcon /></small></button>
          ))}
          {results.length === 0 ? <p className="empty-state">{t('search.empty')}</p> : null}
        </div>
      </div>
    </div>
  );
}
