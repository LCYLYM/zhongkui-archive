import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { archivePath } from '../lib/archive.mjs';
import { ArrowIcon } from './Icons.jsx';

const copy = [
  { zh: '白衣入画', en: 'A figure in white', text: '从荒野独行，到水下与群战，白衣人物贯穿这段实机。先看身形，再沿镜头靠近。', textEn: 'From a solitary walk to underwater scenes and combat, this figure threads through the demo. Begin with the silhouette, then move closer.', note: '原片线索 · 00:00—01:07', noteEn: 'Footage notes · 00:00–01:07', chapter: 'wilderness' },
  { zh: '近观其人', en: 'Closer to the face', text: '发髻、眉眼与神态，组成了我们对人物的第一印象。官方尚未用姓名标注这名角色，身份仍需后续消息确认。', textEn: 'The topknot, eyes and expression shape a first impression. Official footage has not named this character; his identity remains open.', note: '人物志 · 姓名待考', noteEn: 'Character record · Identity unconfirmed', chapter: null },
  { zh: '衣间见细节', en: 'Layers of clothing', text: '交叠的衣领、束腰与手臂绑缚，可以从不同角度细看。三维造型中的补全细节属于同人建模，回到原片才能核对。', textEn: 'Follow the crossed collar, waist sash and arm wraps. Reconstructed details belong to this fan model; the original footage remains the source.', note: '原片线索 · 02:14—04:34', noteEn: 'Footage notes · 02:14–04:34', chapter: 'first-fight' },
  { zh: '转身，继续寻迹', en: 'Turn, then follow the trail', text: '一次转身，补全空间里的轮廓。继续向下，回到消息、原片和考据；每一个推断，都应有可回看的出处。', textEn: 'A turn reveals the full silhouette. Continue down to releases, footage and research, with a source behind every observation.', note: '继续阅览 · 消息与出处', noteEn: 'Keep reading · Sources and releases', chapter: 'stream' },
];

export default function CharacterStory({ compact = false, onInspect }) {
  const { locale } = useI18n(); const en = locale === 'en';
  const section = useRef(null), host = useRef(null), engine = useRef(null), progress = useRef(0);
  const [status, setStatus] = useState('waiting'), [free, setFree] = useState(false), [quality, setQuality] = useState('balanced'), [hasModel, setHasModel] = useState(false);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0), [compactShot, setCompactShot] = useState(0);
  useEffect(() => {
    let cancelled = false, booting = false;
    const observer = new IntersectionObserver(async entries => {
      if (!entries.at(-1).isIntersecting || booting) return;
      booting = true; observer.disconnect(); setStatus('loading');
      const selectedQuality = navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4) || matchMedia('(max-width:700px)').matches ? 'compact' : 'balanced';
      setQuality(selectedQuality);
      try {
        const { createCharacterRenderer } = await import('../lib/character-renderer.js');
        if (cancelled) return;
        engine.current = createCharacterRenderer(host.current, { quality: selectedQuality, onStatus: event => {
          if (cancelled) return;
          setStatus(event.status);
          if (event.status === 'ready') { setHasModel(true); setFailure(''); setQuality(event.quality); }
          if (event.status === 'error') setFailure(event.message);
        } });
        engine.current.setProgress(progress.current);
        if (onInspect) onInspect(engine.current);
      } catch (error) { if (!cancelled) { setStatus('error'); setFailure(error.message); } }
    }, { rootMargin: '600px 0px' });
    observer.observe(section.current);
    return () => { cancelled = true; observer.disconnect(); engine.current?.dispose(); engine.current = null; };
  }, [retry]);
  useEffect(() => {
    const element = section.current;
    let frame = 0, stops = [0, 1, 2, 3], active = -1;
    const steps = [...element.querySelectorAll('[data-character-step]')];
    const line = element.querySelector('.character-reading-line i');
    function read() {
      frame = 0;
      if (compact) return;
      const y = window.scrollY;
      let value = y >= stops[3] ? 1 : 0;
      for (let index = 0; index < 3; index++) if (y >= stops[index] && y < stops[index + 1]) {
        value = (index + (y - stops[index]) / Math.max(1, stops[index + 1] - stops[index])) / 3;
      }
      progress.current = value; engine.current?.setProgress(value);
      if (line) line.style.transform = `scaleY(${value})`;
      const index = Math.min(3, Math.round(value * 3));
      if (active !== index) { active = index; steps.forEach((step, i) => step.dataset.current = String(i === index)); element.dataset.shot = String(index); }
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(read); };
    const measure = () => {
      const sticky = element.querySelector('.character-sticky');
      const stageBottom = matchMedia('(max-width:700px)').matches ? 62 + sticky.offsetHeight : 0;
      const readingCenter = stageBottom + (innerHeight - stageBottom) / 2;
      stops = steps.map(step => {
        const first = step.firstElementChild.getBoundingClientRect(), last = step.lastElementChild.getBoundingClientRect();
        return (first.top + last.bottom) / 2 + window.scrollY - readingCenter;
      });
      wake();
    };
    const resize = new ResizeObserver(measure); resize.observe(element);
    addEventListener('scroll', wake, { passive: true }); addEventListener('resize', measure, { passive: true }); measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); removeEventListener('scroll', wake); removeEventListener('resize', measure); };
  }, [compact]);
  function toggleFree() { const next = !free; setFree(next); engine.current?.setFree(next); }
  return <section className={`character-story ${compact ? 'character-story--compact' : ''}`} id={compact ? 'character-study' : 'dossiers'} data-home-section={compact ? undefined : 'dossiers'} ref={section} aria-label={en ? 'A continuous character study' : '人物展卷，随滚动观览'}>
    <div className="character-sticky">
      <div className="character-stage-heading"><span>{en ? '02 / CHARACTER STUDY' : '贰 · 人物展卷'}</span><h2>{en ? 'White-Clad Swordsman' : '白衣剑士'}</h2><p>{en ? 'Scroll to move from silhouette to detail' : '随卷行进　由身形至细节'}</p></div>
      <div className="character-stage-backdrop" aria-hidden="true"><span>形</span><i /></div>
      <div className="character-webgl" ref={host} />
      {!hasModel && <div className="character-model-poster"><img src="/assets/official/swordsman-cover.png" alt={en ? 'Official gameplay cover' : '官方实机封面'} loading="lazy" /><p role="status">{status === 'error' ? (en ? 'Model unavailable' : '人物模型暂未载入') : (en ? 'Preparing the character…' : '正在展卷…')}</p></div>}
      <div className="character-stage-tools"><button onClick={toggleFree} aria-pressed={free} disabled={!hasModel}>{free ? (en ? 'Return to the story' : '回到阅览') : (en ? 'Inspect freely' : '自由观察')}<ArrowIcon /></button><div aria-label={en ? 'Model quality' : '显示品质'}><button aria-pressed={quality === 'compact'} disabled={status === 'loading'} onClick={() => engine.current?.setQuality('compact')}>{en ? 'Light' : '流畅'}</button><button aria-pressed={quality === 'balanced'} disabled={status === 'loading'} onClick={() => engine.current?.setQuality('balanced')}>{en ? 'Detail' : '精细'}</button></div></div>
      {compact && <nav className="character-compact-views" aria-label={en ? 'Camera views' : '观览镜头'}>{(en ? ['Figure','Face','Clothing','Back'] : ['全身','面容','衣饰','背部']).map((label, index) => <button key={label} disabled={!hasModel} aria-pressed={index === compactShot} onClick={() => { setFree(false); engine.current?.setFree(false); progress.current = index / 3; setCompactShot(index); engine.current?.setProgress(progress.current); }}>{label}</button>)}</nav>}
      <p className="character-stage-hint" role="status">{status === 'error' ? <>{en ? 'Unable to load the model. ' : '模型载入失败。'}<button onClick={() => { engine.current?.dispose(); engine.current = null; setHasModel(false); setFree(false); setRetry(value => value + 1); }}>{en ? 'Retry' : '重试'}</button><small>{failure}</small></> : free ? (en ? 'Drag the figure to turn it. Scroll outside the figure to continue.' : '拖动人物查看角度；在画面外滚动，可继续阅览。') : (en ? 'Fan model · Official footage remains the source' : '同人三维建模 · 人物信息以官方原片为准')}</p>
    </div>
    <div className="character-story-copy"><div className="character-reading-line" aria-hidden="true"><i /></div>{copy.map((item, index) => <article key={item.zh} data-character-step data-current={index === 0 ? 'true' : 'false'}>
      <span className="story-step-number">0{index + 1}</span><small>{en ? item.noteEn : item.note}</small><h3>{en ? item.en : item.zh}</h3><p>{en ? item.textEn : item.text}</p>
      {item.chapter === 'stream' ? <a href={compact ? archivePath('stream', '', locale) : '#stream'} data-archive-link={compact ? '' : undefined}>{en ? 'Continue to the sources' : '继续，查看出处'}<ArrowIcon /></a> : <a data-archive-link href={archivePath(item.chapter ? 'frames' : 'dossiers', item.chapter || 'white-swordsman', locale)}>{en ? 'Read the original record' : '查看对应记录'}<ArrowIcon /></a>}
    </article>)}</div>
  </section>;
}
