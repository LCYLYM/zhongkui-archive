import { BookmarkIcon, MenuIcon, SearchIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

const nav = [
  ['nav.stream', 'stream'],
  ['nav.origins', 'origins'],
  ['nav.frames', 'frames'],
  ['nav.dossiers', 'dossiers'],
  ['nav.overseas', 'overseas'],
];

export default function Sidebar({ activeSection, savedCount, onSearch, menuOpen, setMenuOpen }) {
  const { t, toggleLocale } = useI18n();
  const jump = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <>
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('a11y.openNav')} aria-expanded={menuOpen}>
          <MenuIcon />
        </button>
        <button className="mobile-brand" onClick={() => jump('top')}>{t('footer.mark')}</button>
        <span className="mobile-actions"><button className="language-button" onClick={toggleLocale} aria-label={t('nav.languageLabel')}>{t('nav.language')}</button><button className="icon-button" onClick={onSearch} aria-label={t('a11y.searchAll')}><SearchIcon /></button></span>
      </header>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <button className="seal" onClick={() => jump('top')} aria-label={t('a11y.home')}>
          <img src="/assets/ui/zhongkui-seal.png" alt="" />
        </button>
        <nav aria-label={t('a11y.mainNav')}>
          {nav.map(([labelKey, id]) => (
            <button key={id} className={activeSection === id || (activeSection === 'top' && id === 'stream') ? 'active' : ''} onClick={() => jump(id)}>
              <span>{t(labelKey)}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <button onClick={onSearch}><SearchIcon /><span>{t('nav.search')}</span></button>
          <button onClick={() => jump('saved')}><BookmarkIcon filled={savedCount > 0} /><span>{t('nav.saved', { count: String(savedCount).padStart(2, '0') })}</span></button>
          <button className="sidebar-language" onClick={toggleLocale} aria-label={t('nav.languageLabel')}><span className="language-glyph">文</span><span>{t('nav.languageLabel')}</span></button>
        </div>
        <p className="sidebar-note">{t('site.unofficial')}<br />{t('site.verified')}</p>
      </aside>
    </>
  );
}
