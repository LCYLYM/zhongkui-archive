import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Hero from './components/Hero.jsx';
import SourceStream from './components/SourceStream.jsx';
import Origins from './components/Origins.jsx';
import FrameArchive from './components/FrameArchive.jsx';
import Dossiers from './components/Dossiers.jsx';
import Overseas from './components/Overseas.jsx';
import { ItemOverlay, SearchOverlay, VideoOverlay } from './components/Overlays.jsx';
import { sourceItems } from './data/content.js';
import { localizeItem, useI18n } from './i18n.jsx';

const STORAGE_KEY = 'zhongkui-archive:saved:v1';

function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export default function App() {
  const { locale, t } = useI18n();
  const [activeSection, setActiveSection] = useState('top');
  const [savedIds, setSavedIds] = useState(readSaved);
  const [videoSeconds, setVideoSeconds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const localizedItems = useMemo(() => sourceItems.map((item) => localizeItem(item, locale)), [locale]);
  const overseas = useMemo(() => localizedItems.filter((item) => item.type === 'overseas'), [localizedItems]);
  const selectedItem = useMemo(() => localizedItems.find((item) => item.id === selectedId) ?? null, [localizedItems, selectedId]);

  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-section]')];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.dataset.section);
    }, { rootMargin: '-20% 0px -60%', threshold: [0.05, 0.25, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const toggleSaved = (id) => {
    setSavedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const openItem = (item) => {
    setSearchOpen(false);
    if (item.id === 'official-820') setVideoSeconds(0);
    else setSelectedId(item.id);
  };

  return (
    <div className="app-shell">
      <a href="#stream" className="skip-link">{t('a11y.skip')}</a>
      <Sidebar activeSection={activeSection} savedCount={savedIds.size} onSearch={() => setSearchOpen(true)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <Hero onPlay={() => setVideoSeconds(0)} />
        <div className="page-surface">
          <SourceStream items={localizedItems} savedIds={savedIds} onToggleSaved={toggleSaved} onOpenItem={openItem} />
          <Origins />
          <FrameArchive onPlayAt={setVideoSeconds} />
          <Dossiers />
          <Overseas items={overseas} onOpenItem={openItem} />
          <SavedSection items={localizedItems.filter((item) => savedIds.has(item.id))} onOpenItem={openItem} />
          <SiteFooter />
        </div>
      </main>
      {videoSeconds !== null ? <VideoOverlay seconds={videoSeconds} onClose={() => setVideoSeconds(null)} /> : null}
      {selectedItem ? <ItemOverlay item={selectedItem} saved={savedIds.has(selectedItem.id)} onToggleSaved={toggleSaved} onClose={() => setSelectedId(null)} /> : null}
      {searchOpen ? <SearchOverlay items={localizedItems} onClose={() => setSearchOpen(false)} onOpenItem={openItem} /> : null}
    </div>
  );
}

function SavedSection({ items, onOpenItem }) {
  const { t } = useI18n();
  return (
    <section className="section saved-section" id="saved">
      <div className="section-heading"><div><h2>{t('saved.title')}</h2><p>{t('saved.subtitle')}</p></div><p className="section-index">{t('saved.count', { count: String(items.length).padStart(2, '0') })}</p></div>
      {items.length ? <div className="saved-list">{items.map((item) => <button key={item.id} onClick={() => onOpenItem(item)}><span>{item.source}</span><strong>{item.title}</strong><time>{item.date}</time></button>)}</div> : <p className="empty-state">{t('saved.empty')}</p>}
    </section>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <p className="footer-mark">{t('footer.mark')}</p>
      <div><p>{t('footer.line')}</p><small>{t('footer.legal')}</small></div>
      <div className="footer-links"><a href="https://gamesci.cn/zhongkui/" target="_blank" rel="noreferrer">{t('footer.game')}</a><a href="https://www.youtube.com/@BlackMythGame" target="_blank" rel="noreferrer">Official YouTube</a><a href="https://space.bilibili.com/642389251" target="_blank" rel="noreferrer">{t('footer.bilibili')}</a></div>
    </footer>
  );
}
