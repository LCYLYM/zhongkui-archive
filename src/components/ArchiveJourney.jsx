import { useEffect, useRef, useState } from 'react';
import { frameChapters } from '../data/content.js';
import { useI18n } from '../i18n.jsx';
import { archivePath } from '../lib/archive.mjs';
import { ArrowIcon, PlayIcon } from './Icons.jsx';
import CharacterStory from './CharacterStory.jsx';
import Origins from './Origins.jsx';
import Overseas from './Overseas.jsx';
import '../journey.css';

const trail = ['wilderness', 'first-fight', 'clam-lord'].map(id => frameChapters.find(item => item.id === id));
export default function ArchiveJourney({ items, onPlayAt, onOpenItem, onSectionChange, onInspect }) {
  const { locale } = useI18n(); const en = locale === 'en';
  const book = useRef(null), [chapter, setChapter] = useState(0);
  useEffect(() => {
    const root = book.current, sections = [...document.querySelectorAll('[data-home-section]')], steps = [...root.querySelectorAll('[data-trail-step]')];
    const line = root.querySelector('.footage-trace i');
    let frame = 0, positions = [], stepPositions = [], previousSection = '', previousStep = -1;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    const entries = new IntersectionObserver(events => {
      for (const event of events) if (event.isIntersecting) { event.target.dataset.revealed = 'true'; entries.unobserve(event.target); }
    }, { threshold: .12 });
    root.querySelectorAll('[data-reveal]').forEach(element => { if (!reduced.matches) { element.dataset.revealed = 'false'; entries.observe(element); } });
    function paint() {
      frame = 0;
      const y = scrollY + innerHeight * .45;
      let current = 'top'; for (const item of positions) if (item.top <= y) current = item.id;
      if (previousSection !== current) { previousSection = current; onSectionChange(current); }
      let active = 0; stepPositions.forEach((top, index) => { if (top <= y) active = index; });
      if (active !== previousStep) { previousStep = active; setChapter(active); steps.forEach((step, index) => step.dataset.phase = index < active ? 'past' : index === active ? 'active' : 'future'); }
      const span = stepPositions.at(-1) - stepPositions[0];
      if (line) line.style.transform = `scaleY(${Math.max(0, Math.min(1, (y - stepPositions[0]) / (span || 1)))})`;
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(paint); };
    function measure() {
      positions = sections.map(element => ({ top: element.getBoundingClientRect().top + scrollY, id: element.dataset.homeSection }));
      stepPositions = steps.map(element => element.getBoundingClientRect().top + scrollY + element.offsetHeight * .35);
      wake();
    }
    const resize = new ResizeObserver(measure); resize.observe(root);
    addEventListener('scroll', wake, { passive: true }); addEventListener('resize', measure, { passive: true }); measure();
    return () => { cancelAnimationFrame(frame); entries.disconnect(); resize.disconnect(); removeEventListener('scroll', wake); removeEventListener('resize', measure); };
  }, [locale, onSectionChange]);
  const selected = trail[chapter];
  return <div className="archive-continuum" ref={book}>
    <section className="footage-journey" id="frames" data-home-section="frames">
      <header className="journey-heading" data-reveal><span>{en ? '01 / FOLLOW THE FOOTAGE' : '壹 · 循影寻迹'}</span><h2>{en ? <>Start with the footage.<br />Follow what it reveals.</> : <>从一帧画面，<br />走进这个世界。</>}</h2><p>{en ? 'Keep scrolling. Three moments lead from the opening landscape to the first named encounter.' : '向下阅览，从荒野独行，到拔剑初战，再到有名有姓的相遇。'}</p></header>
      <div className="footage-trail">
        <div className="footage-sticky"><button className="footage-window" onClick={() => onPlayAt(selected.seconds)} aria-label={en ? `Play original footage at ${selected.time}` : `从 ${selected.time} 播放原片`}><img src="/assets/official/swordsman-cover.png" alt={en ? 'Official gameplay cover' : '官方实机封面'} loading="lazy" /><span className="footage-window-shade" /><span className="footage-source">{en ? 'OFFICIAL GAMEPLAY / COVER' : '游戏科学 · 实机原片封面'}</span><span className="footage-play"><PlayIcon /><span>{en ? 'Return to the footage' : '回看这一段原片'}<time>{selected.time}</time></span></span></button><div className="footage-position"><span>0{chapter + 1} / 03</span><p>{en ? 'The notes advance as you scroll' : '随卷行进，线索依次展开'}</p></div></div>
        <div className="footage-notes"><div className="footage-trace" aria-hidden="true"><i /></div>{trail.map((item, index) => <article key={item.id} data-trail-step data-phase={index === 0 ? 'active' : 'future'}><span className="trail-node" aria-hidden="true">0{index + 1}</span><time>{item.range}</time><h3>{en ? item.titleEn : item.title}</h3><ul>{(en ? item.observedEn : item.observed).map(text => <li key={text}>{text}</li>)}</ul><p className="trail-question"><span>{en ? 'Still open' : '留待考证'}</span>{(en ? item.unknownEn : item.unknown)[0]}</p><a data-archive-link href={archivePath('frames', item.id, locale)}>{en ? 'Read this chapter' : '展开本章记录'}<ArrowIcon /></a></article>)}</div>
      </div>
      <a className="journey-continue" href="#dossiers"><span>{en ? 'Next: the figure in white' : '循着白衣，近观其人'}</span><i aria-hidden="true">↓</i></a>
    </section>
    <CharacterStory onInspect={onInspect} />
    <section className="journey-sources" id="stream" data-home-section="stream">
      <header className="journey-heading" data-reveal><span>{en ? '03 / THE SOURCE RECORD' : '叁 · 消息与出处'}</span><h2>{en ? 'Every thread returns\nto its source.' : '有所见，亦有所据。'}</h2><p>{en ? 'Official releases, creator analysis and open questions remain distinct. Open a record to trace the original.' : '官方发布、作者解读与待考线索，各有来处。沿着记录，回到原始材料。'}</p></header>
      <div className="journey-source-list">{items.slice(0, 5).map(item => <a data-archive-link href={archivePath('source', item.id, locale)} key={item.id}><time>{item.date}</time><div><small>{item.source} · {item.platform}</small><h3>{item.title}</h3><p>{item.summary}</p></div><ArrowIcon /></a>)}</div>
      <a className="journey-more" data-archive-link href={archivePath('stream', '', locale)}>{en ? 'Browse the complete source archive' : '查阅全部资料'}<ArrowIcon /></a>
    </section>
    <Origins embedded />
    <Overseas embedded items={items.filter(item => item.type === 'overseas')} onOpenItem={onOpenItem} />
    <div className="journey-end"><span>{en ? 'THE RECORD CONTINUES' : '此卷未完，来日续录'}</span><p>{en ? 'More traces will enter the archive as new sources appear.' : '新的画面与消息，仍将陆续入卷。'}</p><a href="#top">{en ? 'Return to the opening' : '回到卷首'} ↑</a></div>
  </div>;
}
