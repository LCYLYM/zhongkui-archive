import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from './components/Sidebar.jsx';
import Hero from './components/Hero.jsx';
import ArchiveJourney from './components/ArchiveJourney.jsx';
import SourceStream from './components/SourceStream.jsx';
import Origins from './components/Origins.jsx';
import FrameArchive from './components/FrameArchive.jsx';
import Dossiers from './components/Dossiers.jsx';
import Overseas from './components/Overseas.jsx';
import { ItemOverlay, SearchOverlay, VideoOverlay } from './components/Overlays.jsx';
import { sourceItems, dossiers, frameChapters } from './data/content.js';
import { archivePath, makeSearchRecords, parseArchivePath } from './lib/archive.mjs';
import { localizeItem, useI18n } from './i18n.jsx';
const STORAGE_KEY = 'zhongkui-archive:saved:v1';
function readSaved() {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return new Set(Array.isArray(parsed) ? parsed : []); } catch { return new Set(); }
}

export default function App({ initialPath = '/' }) {
  const { locale, t, setLocale } = useI18n();
  const [route, setRoute] = useState(() => parseArchivePath(typeof window === 'undefined' ? initialPath : location.pathname));
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [videoSeconds, setVideoSeconds] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeSection, setHomeSection] = useState('top');
  const transition = useRef(null), navigationSequence = useRef(0), modelApi = useRef(null);
  const allItems = useMemo(() => sourceItems.map(item => localizeItem(item, locale)), [locale]);
  const localizedItems = useMemo(() => [...allItems].sort((a, b) => {
    const preference = item => item.type === 'official' ? 0 : item.platform === (locale === 'zh' ? 'BILIBILI' : 'YOUTUBE') ? 1 : 2;
    return b.date.localeCompare(a.date) || preference(a) - preference(b);
  }), [allItems, locale]);
  const searchRecords = useMemo(() => makeSearchRecords({ sources: sourceItems, characters: dossiers, chapters: frameChapters }, locale), [locale]);
  const selectedItem = route.section === 'source' ? allItems.find(item => item.id === route.id) : null;

  function navigate(href, { preserveScroll = false, animate = true } = {}) {
    const next = parseArchivePath(href);
    const token = ++navigationSequence.current;
    transition.current?.skipTransition();
    if (location.pathname !== href) { history.replaceState({ ...history.state, scroll: window.scrollY }, '', location.href); history.pushState({ scroll: preserveScroll ? window.scrollY : 0 }, '', href); }
    const apply = () => {
      if (token !== navigationSequence.current) return;
      setRoute(next); setLocale(next.locale); setSearchOpen(false); setMenuOpen(false); setVideoSeconds(null);
      if (!preserveScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    };
    if (animate && document.startViewTransition && !matchMedia('(prefers-reduced-motion:reduce)').matches) transition.current = document.startViewTransition(() => flushSync(apply));
    else apply();
  }
  useEffect(() => {
    setSavedIds(readSaved());
    const oldRestoration = history.scrollRestoration; history.scrollRestoration = 'manual';
    const restorePosition = () => {
      const anchor = location.hash && document.getElementById(location.hash.slice(1));
      if (Number.isFinite(history.state?.scroll)) window.scrollTo({ top: history.state.scroll, behavior: 'instant' });
      else if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    };
    const initialRestore = requestAnimationFrame(restorePosition);
    const savePosition = () => history.replaceState({ ...history.state, scroll: window.scrollY }, '', location.href);
    const pop = () => {
      navigationSequence.current++; transition.current?.skipTransition();
      const next = parseArchivePath(location.pathname);
      flushSync(() => { setRoute(next); setLocale(next.locale); setSearchOpen(false); setVideoSeconds(null); setMenuOpen(false); });
      requestAnimationFrame(restorePosition);
    };
    const keys = event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setSearchOpen(true); }
    };
    const links = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[data-archive-link]');
      if (link) { event.preventDefault(); navigate(link.getAttribute('href'), { animate: event.detail !== 0 }); }
      const anchor = event.target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href'), target = document.getElementById(href.slice(1));
        if (target) {
          event.preventDefault();
          history.replaceState({ ...history.state, scroll: window.scrollY }, '', location.href);
          if (location.hash !== href) history.pushState({}, '', href);
          target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
          if (href === '#page-content') target.focus({ preventScroll: true });
        }
        setMenuOpen(false);
      }
    };
    window.addEventListener('popstate', pop); document.addEventListener('click', links); window.addEventListener('keydown', keys);
    window.addEventListener('pagehide', savePosition);
    return () => { cancelAnimationFrame(initialRestore); history.scrollRestoration = oldRestoration; window.removeEventListener('popstate', pop); document.removeEventListener('click', links); window.removeEventListener('keydown', keys); window.removeEventListener('pagehide', savePosition); };
  }, []);
  useEffect(() => {
    if (locale !== route.locale) navigate(archivePath(route.section, route.id, locale), { preserveScroll: true, animate: false });
  }, [locale]);
  useEffect(() => {
    const label = route.section === 'dossiers' ? dossiers.find(item => item.id === route.id)?.[locale === 'en' ? 'nameEn' : 'name'] : route.section === 'frames' ? frameChapters.find(item => item.id === route.id)?.[locale === 'en' ? 'titleEn' : 'title'] : selectedItem?.title;
    document.title = `${label ? `${label}｜` : ''}${locale === 'zh' ? '钟馗志｜黑神话：钟馗资料站' : 'Zhong Kui Archive | Black Myth: Zhong Kui'}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://zk.syal.site${archivePath(route.section, route.id, locale)}`);
  }, [route, locale, selectedItem]);
  const toggleSaved = id => setSavedIds(current => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* Bookmarks remain usable in this session. */ }
    return next;
  });
  const openItem = item => navigate(archivePath('source', item.id, locale));
  const section = route.section === 'source' ? 'stream' : route.section;
  return (
    <div className={`app-shell app-shell--${section}`}>
      <a href="#page-content" className="skip-link">{t('a11y.skip')}</a>
      <Sidebar activeSection={section === 'top' ? homeSection : section} continuous={section === 'top'} savedCount={savedIds.size} onSearch={() => setSearchOpen(true)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main id="page-content" tabIndex={-1}>
        <div className="scene-page" key={section}>
          {section === 'top' ? <><Hero onPlay={() => setVideoSeconds(0)} onSearch={() => setSearchOpen(true)} /><ArchiveJourney items={localizedItems} onPlayAt={setVideoSeconds} onOpenItem={openItem} onSectionChange={setHomeSection} onInspect={api => { modelApi.current = api; }} /><SiteFooter /></> : <div className="page-surface">
            {section === 'stream' && <SourceStream items={localizedItems} savedIds={savedIds} onToggleSaved={toggleSaved} onOpenItem={openItem} />}
            {section === 'origins' && <Origins />}
            {section === 'frames' && <FrameArchive selectedId={route.id || 'wilderness'} onSelect={id => navigate(archivePath('frames', id, locale))} onPlayAt={setVideoSeconds} />}
            {section === 'dossiers' && <Dossiers items={allItems} selectedId={route.id || 'white-swordsman'} onSelect={id => navigate(archivePath('dossiers', id, locale))} onOpenItem={openItem} />}
            {section === 'overseas' && <Overseas items={allItems.filter(item => item.type === 'overseas')} onOpenItem={openItem} />}
            {section === 'saved' && <SavedSection items={allItems.filter(item => savedIds.has(item.id))} onOpenItem={openItem} />}
            <SiteFooter />
          </div>}
        </div>
      </main>
      {videoSeconds !== null && <VideoOverlay seconds={videoSeconds} onClose={() => setVideoSeconds(null)} />}
      {selectedItem && <ItemOverlay item={selectedItem} saved={savedIds.has(selectedItem.id)} onToggleSaved={toggleSaved} onPlay={selectedItem.id === 'official-820' ? () => { navigate(archivePath('stream', '', locale), { animate: false }); setVideoSeconds(0); } : undefined} onClose={() => navigate(archivePath('stream', '', locale))} />}
      {searchOpen && <SearchOverlay records={searchRecords} onClose={() => setSearchOpen(false)} onNavigate={navigate} />}
    </div>
  );
}
function SavedSection({ items, onOpenItem }) {
  const { t } = useI18n();
  return <section className="section saved-section" id="saved"><div className="section-heading"><div><h1>{t('saved.title')}</h1><p>{t('saved.subtitle')}</p></div><p className="section-index">{t('saved.count', { count: String(items.length).padStart(2, '0') })}</p></div>{items.length ? <div className="saved-list">{items.map(item => <button key={item.id} onClick={() => onOpenItem(item)}><span>{item.source}</span><strong>{item.title}</strong><time>{item.date}</time></button>)}</div> : <p className="empty-state">{t('saved.empty')}</p>}</section>;
}
function SiteFooter() {
  const { t } = useI18n();
  return <footer className="site-footer"><p className="footer-mark">{t('footer.mark')}</p><div><p>{t('footer.line')}</p><small>{t('footer.legal')}</small></div><div className="footer-links"><a href="https://gamesci.cn/zhongkui/" target="_blank" rel="noreferrer">{t('footer.game')}</a><a href="https://www.youtube.com/@BlackMythGame" target="_blank" rel="noreferrer">Official YouTube</a><a href="https://space.bilibili.com/642389251" target="_blank" rel="noreferrer">{t('footer.bilibili')}</a></div></footer>;
}
