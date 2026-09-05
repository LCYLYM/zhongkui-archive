import { BookmarkIcon, MenuIcon, SearchIcon } from './Icons.jsx';
import { archivePath } from '../lib/archive.mjs';
import { useI18n } from '../i18n.jsx';

const nav = [
  ['nav.stream', 'stream'],
  ['nav.origins', 'origins'],
  ['nav.frames', 'frames'],
  ['nav.dossiers', 'dossiers'],
  ['nav.overseas', 'overseas'],
];

export default function Sidebar({ activeSection, continuous = false, savedCount, onSearch, menuOpen, setMenuOpen }) {
  const { t, toggleLocale, locale } = useI18n();
  const jump = (id) => {
    document.querySelector(`a[data-nav="${id}"]`)?.click();
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
        <a className="seal" data-archive-link={continuous ? undefined : ''} data-nav="top" href={continuous ? '#top' : archivePath('top', '', locale)} aria-label={t('a11y.home')}>
          <img src="/assets/ui/zhongkui-seal.webp" alt="" />
        </a>
        <nav aria-label={t('a11y.mainNav')}>
          {nav.map(([labelKey, id]) => (
            <a data-archive-link={continuous ? undefined : ''} data-nav={id} href={continuous ? `#${id}` : archivePath(id, '', locale)} key={id} className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? (continuous ? 'location' : 'page') : undefined}>
              <span>{t(labelKey)}</span><i aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="sidebar-tools">
          <button onClick={onSearch}><SearchIcon /><span>{t('nav.search')}</span></button>
          <a data-archive-link href={archivePath('saved', '', locale)}><BookmarkIcon filled={savedCount > 0} /><span>{t('nav.saved', { count: String(savedCount).padStart(2, '0') })}</span></a>
          <button className="sidebar-language" onClick={toggleLocale} aria-label={t('nav.languageLabel')}><span className="language-glyph">文</span><span>{t('nav.languageLabel')}</span></button>
        </div>
        <p className="sidebar-note">{t('site.unofficial')}<br />{locale === 'zh' ? '原片 · 考据 · 异闻' : 'Sources · Studies'}</p>
      </aside>
    </>
  );
}
