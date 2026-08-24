import { ArrowIcon, PlayIcon } from './Icons.jsx';
import { useI18n } from '../i18n.jsx';

export default function Overseas({ items, onOpenItem }) {
  const { t } = useI18n();
  return (
    <section className="section overseas-section" id="overseas" data-section="overseas">
      <div className="section-heading">
        <div><h2>{t('overseas.title')}</h2><p>{t('overseas.subtitle')}</p></div>
        <p className="section-index">YOUTUBE · MEDIA</p>
      </div>
      <div className="overseas-lead">
        <div className="overseas-statement"><span>RE:</span><p>{t('overseas.note')}</p></div>
        <div className="overseas-grid">
          {items.map((item, index) => (
            <button className={`overseas-item overseas-item--${index + 1}`} key={item.id} onClick={() => onOpenItem(item)}>
              <span className="overseas-image"><img src={item.image} alt="" /><i><PlayIcon /></i></span>
              <span className="overseas-copy"><small>{item.source} · {item.platform}</small><strong>{item.title}</strong><em>{item.duration}<ArrowIcon /></em></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
