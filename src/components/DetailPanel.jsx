import { t } from '../utils/i18n.js';
import './DetailPanel.css';

export function DetailPanel({ node, allData, onClose }) {
  const spouses = allData.filter(d => d.spouseOf === node.id || (node.spouseOf && d.id === node.spouseOf));
  const targetParentId = node.spouseOf ? node.spouseOf : node.id;
  const children = allData.filter(d => d.parentId === targetParentId);
  const parent = allData.find(d => d.id === node.parentId || d.id === (node.spouseOf && allData.find(s => s.id === node.spouseOf)?.parentId));

  return (
    <div className="detail-panel glass">
      <button className="close-btn btn" onClick={onClose}>×</button>
      
      <div className="panel-header">
        <div className={`panel-avatar ${node.gender === 'female' ? 'female' : ''}`}>
          {node.lastName 
            ? `${node.name.charAt(0)}${node.lastName.charAt(0)}`.toUpperCase() 
            : node.name.substring(0, 2).toUpperCase()}
        </div>
        <h2>{node.name} {node.lastName || ''}</h2>
      </div>

      <div className="panel-content">
        {node.birthday && (
          <div className="info-group">
            <h4>{t('born')}</h4>
            <p>{node.birthday}</p>
          </div>
        )}

        <div className="info-group">
          <h4>{t('gender')}</h4>
          <p>{node.gender === 'female' ? t('female') : t('male')}</p>
        </div>

        <div className="info-group">
          <h4>{t('parent')}</h4>
          <p>{parent ? parent.name : '-'}</p>
        </div>

        {spouses.length > 0 && (
          <div className="info-group">
            <h4>{t('spouse')}</h4>
            <ul className="children-list">
              {spouses.map(s => <li key={s.id}>{s.name} {s.lastName || ''}</li>)}
            </ul>
          </div>
        )}
        
        <div className="info-group">
          <h4>{t('children')} ({children.length})</h4>
          {children.length > 0 ? (
            <ul className="children-list">
              {children.map(c => <li key={c.id}>{c.name} {c.lastName || ''}</li>)}
            </ul>
          ) : (
            <p className="no-data">-</p>
          )}
        </div>
        
        <div className="info-group">
          <h4>{node.notes ? t('notes') : t('detailsTitle')}</h4>
          <p className="bio-text">{node.notes || t('noBio')}</p>
        </div>
      </div>
    </div>
  );
}
