import React, { useState } from 'react';
import {
  Bell, Filter, CheckCheck, Eye, ShieldAlert,
  ArrowUpRight, MapPinPlus, EyeOff, ChevronDown,
  Clock, MapPin, AlertTriangle, X, MessageSquare,
  User, Check, MoreHorizontal
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import './Alerts.css';

const MOCK_ALERTS = [
  {
    id: 'AL-2026-08-17-016', type: 'BUFFER_APPROACH', status: 'new', confidence: 'HIGH',
    tiger: 'PTR-T-001', station: 'ST-42',
    title: 'Buffer zone approach detected',
    summary: 'PTR-T-001 detected 4.8 km from village boundary — closest approach in 3 months.',
    time: '18 min ago', date: '17 Aug 2026, 14:32',
    distanceFromBoundary: '4.8 km', zone: 'Buffer zone',
    evidence: ['/images/tiger_hero.jpg', '/images/tiger_2.jpg'],
    oldPos: { lat: 21.74, lng: 79.31 }, newPos: { lat: 21.81, lng: 79.33 },
    notes: ''
  },
  {
    id: 'AL-2026-08-16-012', type: 'NOVEL_STATION', status: 'new', confidence: 'MEDIUM',
    tiger: 'PTR-T-007', station: 'ST-16',
    title: 'First detection at novel station',
    summary: 'PTR-T-007 detected at station ST-16 for the first time. Possible range expansion.',
    time: '2 hr ago', date: '17 Aug 2026, 12:11',
    distanceFromBoundary: '12.3 km', zone: 'Core zone',
    evidence: ['/images/tiger_2.jpg'],
    oldPos: { lat: 21.76, lng: 79.38 }, newPos: { lat: 21.79, lng: 79.44 },
    notes: ''
  },
  {
    id: 'AL-2026-08-15-009', type: 'PROLONGED_ABSENCE', status: 'acknowledged', confidence: 'LOW',
    tiger: 'PTR-T-021', station: 'ST-09',
    title: 'Prolonged absence — 12 days',
    summary: 'PTR-T-021 has not been detected in 12 days across any monitored station.',
    time: 'Yesterday', date: '16 Aug 2026, 09:12',
    distanceFromBoundary: '—', zone: 'Buffer zone',
    evidence: ['/images/tiger_hero.jpg'],
    oldPos: { lat: 21.70, lng: 79.42 }, newPos: null,
    notes: 'Under observation. May have moved outside camera coverage.'
  },
  {
    id: 'AL-2026-08-14-007', type: 'RANGE_SHIFT', status: 'acknowledged', confidence: 'HIGH',
    tiger: 'PTR-T-041', station: 'ST-12',
    title: 'Significant home range shift',
    summary: 'PTR-T-041 has shifted primary activity zone by 8.2 km northeast over last 14 days.',
    time: '3 days ago', date: '14 Aug 2026, 06:20',
    distanceFromBoundary: '9.1 km', zone: 'Core zone',
    evidence: ['/images/tiger_hero.jpg', '/images/tiger_2.jpg'],
    oldPos: { lat: 21.68, lng: 79.35 }, newPos: { lat: 21.74, lng: 79.42 },
    notes: ''
  },
  {
    id: 'AL-2026-08-10-004', type: 'RANGE_SHIFT', status: 'resolved', confidence: 'MEDIUM',
    tiger: 'PTR-T-095', station: 'ST-33',
    title: 'Seasonal range expansion',
    summary: 'PTR-T-095 expanding into new territory — consistent with post-monsoon dispersal patterns.',
    time: '7 days ago', date: '10 Aug 2026, 21:55',
    distanceFromBoundary: '18.6 km', zone: 'Buffer zone',
    evidence: ['/images/tiger_2.jpg'],
    oldPos: { lat: 21.73, lng: 79.29 }, newPos: { lat: 21.70, lng: 79.36 },
    notes: 'Resolved — confirmed natural seasonal dispersal.'
  },
];

const TYPE_CONFIG = {
  BUFFER_APPROACH:   { icon: ShieldAlert,   label: 'Buffer Approach',    color: 'var(--color-danger)',  bg: 'rgba(239,68,68,0.12)'  },
  NOVEL_STATION:     { icon: MapPinPlus,    label: 'Novel Station',       color: 'var(--color-info)',    bg: 'rgba(59,130,246,0.12)' },
  PROLONGED_ABSENCE: { icon: EyeOff,        label: 'Prolonged Absence',   color: 'var(--color-absent)',  bg: 'rgba(107,114,128,0.12)'},
  RANGE_SHIFT:       { icon: ArrowUpRight,  label: 'Range Shift',         color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.12)' },
};

const STATUS_FILTERS = ['All', 'New', 'Acknowledged', 'Resolved'];
const TYPE_FILTERS   = ['All Types', 'BUFFER_APPROACH', 'NOVEL_STATION', 'PROLONGED_ABSENCE', 'RANGE_SHIFT'];

export default function AlertsPage() {
  const [statusF, setStatusF]   = useState('All');
  const [typeF,   setTypeF]     = useState('All Types');
  const [selected, setSelected] = useState(MOCK_ALERTS[0]);
  const [alerts,   setAlerts]   = useState(MOCK_ALERTS);
  const [note,     setNote]     = useState('');

  const filtered = alerts.filter(a => {
    const ms = statusF === 'All' || a.status === statusF.toLowerCase();
    const mt = typeF   === 'All Types' || a.type === typeF;
    return ms && mt;
  });

  function acknowledge(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    if (selected?.id === id) setSelected(a => ({ ...a, status: 'acknowledged' }));
  }
  function resolve(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    if (selected?.id === id) setSelected(a => ({ ...a, status: 'resolved' }));
  }
  function saveNote() {
    setAlerts(prev => prev.map(a => a.id === selected?.id ? { ...a, notes: note } : a));
    setSelected(a => ({ ...a, notes: note }));
  }

  const conf = selected?.confidence;

  return (
    <div className="alerts-page">

      {/* ── LEFT: Feed ── */}
      <div className="alerts-feed-panel">
        <div className="alerts-feed-header">
          <div>
            <h1 className="alerts-title">Alert Centre</h1>
            <p className="alerts-sub">{filtered.filter(a=>a.status==='new').length} new · {filtered.length} total</p>
          </div>
          <div className="alerts-filter-row">
            <div className="alerts-status-tabs">
              {STATUS_FILTERS.map(s => (
                <button key={s} className={`ast ${statusF===s?'ast--active':''}`} onClick={()=>setStatusF(s)}>{s}</button>
              ))}
            </div>
            <div className="cat-select-wrap">
              <select className="cat-select" value={typeF} onChange={e=>setTypeF(e.target.value)}>
                {TYPE_FILTERS.map(t=><option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={12} className="cat-select-icon"/>
            </div>
          </div>
        </div>

        <div className="alerts-list">
          {filtered.map((alert, i) => {
            const cfg = TYPE_CONFIG[alert.type];
            const Icon = cfg.icon;
            const isBuffer = alert.type === 'BUFFER_APPROACH';
            return (
              <div
                key={alert.id}
                className={`alert-card ${selected?.id===alert.id?'alert-card--active':''} ${isBuffer&&alert.status==='new'?'alert-card--critical':''}`}
                onClick={() => { setSelected(alert); setNote(alert.notes||''); }}
                style={{ '--alert-color': cfg.color, animationDelay: `${i*50}ms` }}
              >
                <div className="alert-card-bar" style={{ background: cfg.color }} />
                <div className="alert-card-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={16} />
                </div>
                <div className="alert-card-body">
                  <div className="alert-card-top">
                    <span className="alert-card-tiger font-mono">{alert.tiger}</span>
                    <Badge variant={alert.confidence === 'HIGH' ? 'high' : alert.confidence === 'MEDIUM' ? 'medium' : 'low'}>
                      {alert.confidence}
                    </Badge>
                  </div>
                  <div className="alert-card-title">{alert.title}</div>
                  <div className="alert-card-summary">{alert.summary}</div>
                  <div className="alert-card-footer">
                    <span className="alert-card-time"><Clock size={11}/>{alert.time}</span>
                    <Badge variant={alert.status==='new'?'danger':alert.status==='acknowledged'?'warning':'success'}>
                      {alert.status}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Detail ── */}
      {selected && (() => {
        const cfg = TYPE_CONFIG[selected.type];
        const Icon = cfg.icon;
        return (
          <div className="alert-detail-panel">
            {/* Header */}
            <div className="alert-detail-header" style={{ borderLeft: `3px solid ${cfg.color}` }}>
              <div className="alert-detail-header-top">
                <div className="alert-detail-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className="alert-detail-id font-mono">{selected.id}</div>
                  <h2 className="alert-detail-title">{selected.title}</h2>
                </div>
              </div>
              <div className="alert-detail-badges">
                <Badge variant={selected.confidence==='HIGH'?'high':selected.confidence==='MEDIUM'?'medium':'low'}>{selected.confidence}</Badge>
                <Badge variant={selected.status==='new'?'danger':selected.status==='acknowledged'?'warning':'success'}>{selected.status}</Badge>
                <span className="alert-detail-type" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            </div>

            <div className="alert-detail-body">
              {/* Summary */}
              <div className="alert-section">
                <p className="alert-detail-summary">{selected.summary}</p>
              </div>

              {/* Key data */}
              <div className="alert-data-grid">
                {[
                  { label: 'Tiger ID', value: selected.tiger },
                  { label: 'Station', value: selected.station },
                  { label: 'Detected', value: selected.date },
                  { label: 'Zone', value: selected.zone },
                  { label: 'Distance to boundary', value: selected.distanceFromBoundary },
                  { label: 'Confidence', value: selected.confidence },
                ].map(({ label, value }) => (
                  <div className="alert-data-item" key={label}>
                    <span className="alert-data-label">{label}</span>
                    <span className="alert-data-value font-mono">{value}</span>
                  </div>
                ))}
              </div>

              {/* Evidence images */}
              {selected.evidence?.length > 0 && (
                <div className="alert-section">
                  <div className="alert-section-title">Evidence images</div>
                  <div className="alert-evidence-grid">
                    {selected.evidence.map((src, i) => (
                      <div key={i} className="alert-evidence-item">
                        <img src={src} alt={`Evidence ${i+1}`} className="alert-evidence-img" />
                        <span className="alert-evidence-label">{selected.station} · {selected.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Position change */}
              {selected.newPos && (
                <div className="alert-section">
                  <div className="alert-section-title">Location change</div>
                  <div className="alert-pos-grid">
                    <div className="alert-pos-item alert-pos-item--old">
                      <span className="alert-pos-label">Previous position</span>
                      <span className="alert-pos-coord font-mono">{selected.oldPos.lat.toFixed(4)}°N, {selected.oldPos.lng.toFixed(4)}°E</span>
                    </div>
                    <ArrowUpRight size={20} style={{ color: cfg.color, alignSelf: 'center' }} />
                    <div className="alert-pos-item alert-pos-item--new">
                      <span className="alert-pos-label">New position</span>
                      <span className="alert-pos-coord font-mono">{selected.newPos.lat.toFixed(4)}°N, {selected.newPos.lng.toFixed(4)}°E</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Officer notes */}
              <div className="alert-section">
                <div className="alert-section-title">Officer notes</div>
                <textarea
                  className="alert-notes-input"
                  placeholder="Add observations or follow-up notes…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                />
                <button className="alert-save-note-btn" onClick={saveNote}>
                  <MessageSquare size={14}/> Save note
                </button>
              </div>

              {/* Actions */}
              <div className="alert-actions">
                {selected.status === 'new' && (
                  <button className="alert-action-btn alert-action-btn--warn" onClick={() => acknowledge(selected.id)}>
                    <Eye size={15}/> Acknowledge
                  </button>
                )}
                {selected.status !== 'resolved' && (
                  <button className="alert-action-btn alert-action-btn--success" onClick={() => resolve(selected.id)}>
                    <Check size={15}/> Mark Resolved
                  </button>
                )}
                <button className="alert-action-btn alert-action-btn--ghost">
                  <X size={15}/> False Positive
                </button>
                <button className="alert-action-btn alert-action-btn--ghost">
                  <User size={15}/> Assign Officer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
