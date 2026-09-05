import { ArrowIcon, PlayIcon, SearchIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';
import { archivePath } from '../lib/archive.mjs';
import { sourceItems, frameChapters, dossiers } from '../data/content.js';
export default function Hero({ onPlay, onSearch }) {
  const { locale } = useI18n(); const en = locale === 'en';
  return <section className="hero arrival" id="top" data-home-section="top">
    <img className="arrival-scene" src="/assets/official/temple-gate.webp" alt="" fetchPriority="high" />
    <div className="arrival-shade" aria-hidden="true" />
    <div className="arrival-caption"><span>{en ? 'AN INDEPENDENT ARCHIVE' : '黑神话：钟馗 · 民间资料站'}</span><a href="https://gamesci.cn/zhongkui/" target="_blank" rel="noreferrer">{en ? 'Game Science ↗' : '游戏科学官网 ↗'}</a></div>
    <div className="arrival-copy">
      <h1><img src="/assets/ui/zhongkui-wordmark.webp" alt={en ? 'Zhong Kui Archive' : '钟馗志'} /></h1>
      <p className="arrival-verse">{en ? 'Follow the footage. Trace the stories.' : '循影寻迹　集异成志'}</p>
      <p className="arrival-description">{en ? 'Official releases, scene notes and character research — with the original sources close at hand.' : '从一帧画面，到一段出处。\n收录官方消息、实机线索与人物考据。'}</p>
      <div className="arrival-actions"><a href="#frames">{en ? 'Begin the journey' : '入卷阅览'}<ArrowIcon /></a><button onClick={onSearch}><SearchIcon />{en ? 'Search' : '检索全志'}</button></div>
    </div>
    <button className="arrival-film" onClick={onPlay}><span className="arrival-film-play"><PlayIcon /></span><span><small>2026.08.20 · 15:53</small><strong>{en ? 'The latest gameplay film' : '十五分钟实机演示'}</strong></span><ArrowIcon /></button>
    <nav className="arrival-index" aria-label={en ? 'Explore the archive' : '资料目录'}>
      <a href="#stream"><span>{en ? 'Sources' : '消息与原片'}</span><small>{sourceItems.length} {en ? 'records' : '篇资料'}<ArrowIcon /></small></a>
      <a href="#frames"><span>{en ? 'Frame notes' : '实机逐帧'}</span><small>{frameChapters.length} {en ? 'chapters' : '段观察'}<ArrowIcon /></small></a>
      <a href="#dossiers"><span>{en ? 'Characters' : '人物与异闻'}</span><small>{dossiers.length} {en ? 'files' : '份档案'}<ArrowIcon /></small></a>
    </nav>
    <a className="arrival-scroll" href="#frames"><span>{en ? 'SCROLL TO EXPLORE' : '向下滚动 · 开始阅览'}</span><i aria-hidden="true">↓</i></a>
  </section>;
}
