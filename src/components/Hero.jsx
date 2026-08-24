import { ArrowIcon, PlayIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function Hero({ onPlay }) {
  const { t } = useI18n();
  return (
    <section className="hero" id="top" data-section="top">
      <div className="hero-atmosphere" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
      </div>
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="hero-wordmark"><img src="/assets/ui/zhongkui-wordmark.png" alt={t('footer.mark')} /></div>
          <p className="hero-subtitle">{t('hero.subtitle').split('\n').map((line, index) => <span key={line}>{index ? <br /> : null}{line}</span>)}</p>
        </div>
        <div className="hero-feature">
          <button className="hero-media" onClick={onPlay} aria-label={t('hero.playLabel')}>
            <img src="/assets/media/BV1kS8H6VERt.jpg" alt={t('hero.coverAlt')} />
            <span className="media-vignette" aria-hidden="true" />
            <span className="media-play"><PlayIcon /><b>{t('hero.watch')}</b></span>
            <span className="media-duration">15:53</span>
          </button>
          <div className="hero-meta">
            <div>
              <time dateTime="2026-08-20">2026.08.20</time>
              <h1>{t('hero.title')}</h1>
              <p>{t('hero.meta')}</p>
            </div>
            <div className="hero-actions">
              <button className="button button--red" onClick={onPlay}>{t('hero.playFull')} <ArrowIcon /></button>
              <button className="button button--line" onClick={() => document.getElementById('frames')?.scrollIntoView({ behavior: 'smooth' })}>{t('hero.frames')} <ArrowIcon /></button>
            </div>
          </div>
        </div>
      </div>
      <div className="source-ribbon" aria-label={t('hero.sourcesLabel')}>
        <span>{t('hero.sources')}</span>
        <a href="https://gamesci.cn/zhongkui/" target="_blank" rel="noreferrer">{t('hero.officialSite')} <ArrowIcon /></a>
        <a href="https://www.bilibili.com/video/BV1kS8H6VERt/" target="_blank" rel="noreferrer">BILIBILI <ArrowIcon /></a>
        <a href="https://www.youtube.com/watch?v=oi2QgPH61JM" target="_blank" rel="noreferrer">YOUTUBE <ArrowIcon /></a>
        <a href="https://www.weibo.com/7483050868" target="_blank" rel="noreferrer">{t('hero.weibo')} <ArrowIcon /></a>
      </div>
    </section>
  );
}
