import { useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { ArrowIcon, CloseIcon, SearchIcon } from './Icons.jsx';
import useDialog from '../lib/useDialog.js';
import { searchArchive } from '../lib/archive.mjs';

export function VideoOverlay({ seconds = 0, onClose }) {
  const { t, locale } = useI18n(); const en = locale === 'en';
  const [platform, setPlatform] = useState(locale === 'zh' ? 'bilibili' : 'youtube');
  const dialog = useDialog(onClose);
  const start = Math.max(0, Math.min(952, Math.floor(seconds)));
  const original = platform === 'bilibili' ? `https://www.bilibili.com/video/BV1kS8H6VERt/?t=${start}` : `https://www.youtube.com/watch?v=oi2QgPH61JM&t=${start}s`;
  const embed = platform === 'bilibili' ? `https://player.bilibili.com/player.html?bvid=BV1kS8H6VERt&autoplay=1&danmaku=false&t=${start}` : `https://www.youtube-nocookie.com/embed/oi2QgPH61JM?autoplay=1&start=${start}`;
  return <div className="overlay" role="dialog" aria-modal="true" aria-label={t('video.label')} ref={dialog} onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="video-dialog"><header><div><small>{en ? 'OFFICIAL GAMEPLAY' : '官方实机原片'} · {String(Math.floor(start / 60)).padStart(2, '0')}:{String(start % 60).padStart(2, '0')}</small><h2>{t('video.title')}</h2></div><button className="icon-button" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button></header>
    <div className="platform-switch" role="group" aria-label={en ? 'Video platform' : '播放平台'}><button aria-pressed={platform === 'bilibili'} onClick={() => setPlatform('bilibili')}>哔哩哔哩</button><button aria-pressed={platform === 'youtube'} onClick={() => setPlatform('youtube')}>YouTube</button><a href={original} target="_blank" rel="noreferrer">{en ? 'Open original' : '在原站打开'}<ArrowIcon /></a></div>
    <div className="video-embed"><iframe key={platform} src={embed} title={t('video.title')} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
    <footer><span>{en ? 'If playback is restricted, switch platform or open the original. Timestamp links use the platform’s own player.' : '若播放器受地区或登录限制，可切换平台或打开原片；定位由原站播放器处理。'}</span></footer></div>
  </div>;
}

export function ItemOverlay({ item, onClose, saved, onToggleSaved, onPlay }) {
  const { t, locale } = useI18n(); const dialog = useDialog(onClose);
  const evidenceKind = ['confirmed', 'analysis', 'speculation', 'reaction'].includes(item.evidence) ? item.evidence : 'analysis';
  return <div className="overlay overlay--item" role="dialog" aria-modal="true" aria-labelledby="item-title" ref={dialog} onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <article className="item-dialog"><button className="icon-button item-close" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button><div className="item-dialog-image"><img src={item.image} alt="" /></div><div className="item-dialog-body">
      <p className={`evidence evidence--${evidenceKind}`}><i>{t(`evidence.${evidenceKind}.mark`)}</i>{t(`evidence.${evidenceKind}.label`)}</p><small>{item.source} · {item.date} · {item.platform}</small><h1 id="item-title">{item.title}</h1><p>{item.summary}</p><div className="tag-line">{item.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>
      <div className="item-actions">{onPlay && <button className="button button--red" onClick={onPlay}>{locale === 'zh' ? '播放原片' : 'Play footage'}<ArrowIcon /></button>}{item.links.map((link, index) => <a className={index === 0 ? 'button button--red' : 'button button--line'} href={link.url} target="_blank" rel="noreferrer" key={link.url}>{link.label}<ArrowIcon /></a>)}<button className="text-button" onClick={() => onToggleSaved(item.id)}>{saved ? t('item.remove') : t('item.save')}</button></div>
    </div></article>
  </div>;
}

export function SearchOverlay({ records, onClose, onNavigate }) {
  const { t, locale } = useI18n(); const en = locale === 'en';
  const [query, setQuery] = useState(''); const [kind, setKind] = useState('all'); const dialog = useDialog(onClose);
  const results = useMemo(() => searchArchive(query, records, kind), [query, records, kind]);
  const labels = en ? { all: 'Everything', character: 'Characters', chapter: 'Chapters', source: 'Sources' } : { all: '全部', character: '人物', chapter: '章节', source: '来源' };
  return <div className="overlay overlay--search" role="dialog" aria-modal="true" aria-label={t('search.label')} ref={dialog} onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="search-dialog">
    <header><SearchIcon /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? 'Character, scene, author or keyword…' : '人物、场景、作者，或一条线索…'} aria-label={t('search.inputLabel')} /><button className="icon-button" onClick={onClose} aria-label={t('a11y.close')}><CloseIcon /></button></header>
    <div className="search-kinds" role="group" aria-label={en ? 'Result type' : '结果类型'}>{Object.entries(labels).map(([key, label]) => <button key={key} aria-pressed={kind === key} onClick={() => setKind(key)}>{label}<small>{searchArchive(query, records, key).length}</small></button>)}</div>
    <p className="search-count" role="status">{query ? t('search.found', { count: results.length }) : (en ? 'Browse the archive · Search in Chinese or English' : '全志索引 · 支持中英文名称与别称')}</p>
    {!query && <div className="search-suggestions">{(en ? ['Great Clam Lord', 'elder', 'fire'] : ['大蚌真君', '灰发老人', '火焰']).map(word => <button key={word} onClick={() => setQuery(word)}>{word}</button>)}</div>}
    <div className="search-results">{results.map(item => <a data-archive-link key={`${item.kind}:${item.id}`} href={item.href} onClick={event => { event.preventDefault(); onNavigate(item.href); }}><span>{labels[item.kind]}</span><strong>{item.title}</strong><small>{item.caption}<ArrowIcon /></small></a>)}{!results.length && <p className="empty-state">{en ? 'No matching entry. Try a shorter name or a scene keyword.' : '尚未收录匹配内容。可以试试人物别称、场景名或更短的关键词。'}</p>}</div>
  </div></div>;
}
