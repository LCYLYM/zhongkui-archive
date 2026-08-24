import { ArrowIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

const milestones = [
  { year: '2025.08.20', title: '首支 CG 先导预告', titleEn: 'First CG Teaser', note: '科隆游戏展首曝。官方当时明确：项目仍在早期，暂无实机画面。', noteEn: 'Revealed at Gamescom. The official announcement said the project was still at an early stage and showed no gameplay.', href: 'https://www.youtube.com/watch?v=sqe3j4Qch1Y' },
  { year: '2026.02.10', title: '马年春节实机短片', titleEn: 'Year of the Horse Gameplay Short', note: '约 6 分钟的春节特别短片；官方注明与游戏实际剧情无关。', noteEn: 'A roughly six-minute Lunar New Year short. The official note says it is unrelated to the game’s actual story.', href: 'https://www.bilibili.com/video/BV1HjFQzYEvf/' },
  { year: '2026.08.20', title: '15 分钟实机演示', titleEn: '15-Minute Gameplay Demo', note: '首次展示主角战斗、HUD 与部分剧情片段，成为目前最重要的原始材料。', noteEn: 'The first extended look at protagonist combat, the HUD and selected story scenes; currently the most substantial primary source.', href: 'https://www.youtube.com/watch?v=oi2QgPH61JM' },
];

export default function Origins() {
  const { locale, t } = useI18n();
  return (
    <section className="section origins-section" id="origins" data-section="origins">
      <div className="section-heading">
        <div><h2>{t('origins.title')}</h2><p>{t('origins.subtitle')}</p></div>
        <p className="section-index">{t('origins.index')}</p>
      </div>
      <div className="origin-rail">
        {milestones.map((item, index) => (
          <a href={item.href} target="_blank" rel="noreferrer" key={item.year} className={index === milestones.length - 1 ? 'current' : ''}>
            <time>{item.year}</time><span className="rail-dot" /><h3>{locale === 'en' ? item.titleEn : item.title}</h3><p>{locale === 'en' ? item.noteEn : item.note}</p><span className="text-link">{t('origins.source')} <ArrowIcon /></span>
          </a>
        ))}
      </div>
      <blockquote>
        <p>{t('origins.quote')}</p>
        <cite>{t('origins.cite')}</cite>
      </blockquote>
    </section>
  );
}
