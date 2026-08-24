import { useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { ArrowIcon, BookmarkIcon, PlayIcon } from './Icons.jsx';

const filters = [
  ['all', 'filter.all'], ['official', 'filter.official'], ['analysis', 'filter.analysis'], ['overseas', 'filter.overseas'], ['research', 'filter.research'],
];

function EvidenceMark({ kind }) {
  const { t } = useI18n();
  const resolved = ['confirmed', 'analysis', 'speculation', 'reaction'].includes(kind) ? kind : 'analysis';
  const item = { label: t(`evidence.${resolved}.label`), mark: t(`evidence.${resolved}.mark`), description: t(`evidence.${resolved}.description`) };
  return <span className={`evidence evidence--${kind}`} title={item.description}><i>{item.mark}</i>{item.label}</span>;
}

export default function SourceStream({ items, savedIds, onToggleSaved, onOpenItem }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => filter === 'all' ? items : items.filter((item) => item.type === filter), [filter, items]);
  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <section className="section stream-section" id="stream" data-section="stream">
      <div className="stream-wordmark" aria-hidden="true">
        <img src="/assets/ui/zhongkui-wordmark.png" alt="" />
        <span>{t('stream.kicker')}</span>
      </div>
      <div className="section-heading">
        <div><h2>{t('stream.title')}</h2><p>{t('stream.subtitle')}</p></div>
        <p className="section-index">{t('stream.index')}</p>
      </div>
      <div className="filter-bar" role="tablist" aria-label={t('stream.filterLabel')}>
        {filters.map(([value, labelKey]) => (
          <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{t(labelKey)}</button>
        ))}
      </div>
      {lead ? (
        <article className="lead-story">
          <button className="lead-image" onClick={() => onOpenItem(lead)} aria-label={t('a11y.openItem', { title: lead.title })}>
            <img src={lead.image} alt="" />
            <span><PlayIcon /></span>
          </button>
          <div className="lead-content">
            <EvidenceMark kind={lead.evidence} />
            <h3>{lead.title}</h3>
            <p>{lead.summary}</p>
            <div className="lead-byline"><span>{lead.source}</span><time>{lead.date}</time><span>{lead.duration}</span></div>
            <div className="lead-links">
              {lead.links.slice(0, 2).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}<ArrowIcon /></a>)}
            </div>
          </div>
          <button className={`bookmark ${savedIds.has(lead.id) ? 'active' : ''}`} onClick={() => onToggleSaved(lead.id)} aria-label={savedIds.has(lead.id) ? t('a11y.unsave') : t('a11y.save')}>
            <BookmarkIcon filled={savedIds.has(lead.id)} />
          </button>
        </article>
      ) : <p className="empty-state">{t('stream.empty')}</p>}
      <div className="story-list">
        {rest.map((item, index) => (
          <article className="story-row" key={item.id}>
            <time><b>{item.date.slice(5)}</b><span>{item.time}</span></time>
            <button className="story-main" onClick={() => onOpenItem(item)}>
              <span className="story-number">{String(index + 2).padStart(2, '0')}</span>
              <span><small>{item.source} · {item.platform}</small><strong>{item.title}</strong></span>
            </button>
            <EvidenceMark kind={item.evidence} />
            <button className={`bookmark ${savedIds.has(item.id) ? 'active' : ''}`} onClick={() => onToggleSaved(item.id)} aria-label={savedIds.has(item.id) ? t('a11y.unsave') : t('a11y.save')}>
              <BookmarkIcon filled={savedIds.has(item.id)} />
            </button>
          </article>
        ))}
      </div>
      <EvidenceLegend />
    </section>
  );
}

function EvidenceLegend() {
  const { t } = useI18n();
  const evidence = ['confirmed', 'analysis', 'speculation', 'reaction'];
  return (
    <aside className="evidence-legend">
      <div><h3>{t('evidence.title')}</h3><p>{t('evidence.note')}</p></div>
      {evidence.map((key) => (
        <div className="legend-item" key={key}><i>{t(`evidence.${key}.mark`)}</i><span><b>{t(`evidence.${key}.label`)}</b><small>{t(`evidence.${key}.description`)}</small></span></div>
      ))}
    </aside>
  );
}
