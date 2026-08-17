import React, { useState, useRef, useEffect } from 'react';
import {
  Search, SlidersHorizontal, Plus, Upload, X, ChevronDown,
  Calendar, MapPin, Camera, Activity, Shield, ArrowUpRight,
  Eye, Download, ExternalLink, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { getStoredTigers, saveTiger } from '../lib/tigerStorage';
import './Catalogue.css';

const STATUS_TABS = ['All', 'Active', 'Provisional', 'Absent'];
const DETAIL_TABS = ['Overview', 'Capture History', 'Identity Evidence'];

export default function Catalogue() {
  const [tigers,       setTigers]      = useState(() => getStoredTigers());
  const [search,       setSearch]      = useState('');
  const [statusFilter, setStatusFilter]= useState('All');
  const [sexFilter,    setSexFilter]   = useState('All');
  const [selected,     setSelected]    = useState(() => getStoredTigers()[0]);
  const [detailTab,    setDetailTab]   = useState('Overview');
  const [showUpload,   setShowUpload]  = useState(false);
  const [uploadData,   setUploadData]  = useState({ id: '', sex: 'Male', zone: 'Core', image: null, preview: null });
  const fileRef = useRef();

  // Reload stored tigers if updated
  useEffect(() => {
    const loaded = getStoredTigers();
    setTigers(loaded);
    if (!selected && loaded.length > 0) {
      setSelected(loaded[0]);
    }
  }, []);

  /* Filter logic */
  const filtered = tigers.filter(t => {
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter.toLowerCase();
    const matchSex    = sexFilter === 'All' || t.sex === sexFilter;
    return matchSearch && matchStatus && matchSex;
  });

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setUploadData(d => ({ ...d, image: file, preview }));
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    const newId = `PTR-T-0${String(Math.floor(Math.random() * 900 + 100))}`;
    const newTiger = {
      id: uploadData.id || newId,
      sex: uploadData.sex,
      status: 'provisional',
      zone: uploadData.zone,
      captures: 1,
      lastSeen: 'Today',
      confidence: 0,
      image: uploadData.preview || '/images/tiger_hero.jpg',
      age: 'Unknown',
      firstCaptured: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
      lastCaptured: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
      stations: 1,
      range: '12.4 km²',
      core: '3.1 km²',
      identityConf: 90.0,
      model: 'Pending review',
      verified: false,
      leftFlank: uploadData.preview || '/images/tiger_hero.jpg',
      rightFlank: uploadData.preview || '/images/tiger_2.jpg',
      captures_list: [
        { station: 'ST-01', date: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ', 10:00', confidence: 90.0 }
      ],
    };

    const updated = await saveTiger(newTiger);
    setTigers(updated);
    setSelected(newTiger);
    setShowUpload(false);
    setUploadData({ id: '', sex: 'Male', zone: 'Core', image: null, preview: null });
  }

  const confColor = (c) =>
    c >= 85 ? 'var(--color-success)' :
    c >= 65 ? 'var(--color-warning)' :
    'var(--color-danger)';

  return (
    <div className="catalogue">

      {/* ── LEFT PANEL ── */}
      <div className="cat-list-panel">

        {/* Header */}
        <div className="cat-list-header">
          <div>
            <h1 className="cat-list-title">Tiger Catalogue</h1>
            <p className="cat-list-sub">{filtered.length} individual{filtered.length !== 1 ? 's' : ''} · Pench Tiger Reserve</p>
          </div>
          <button className="cat-add-btn" onClick={() => setShowUpload(true)} id="add-tiger-btn">
            <Plus size={16} />
            Add new tiger
          </button>
        </div>

        {/* Search + Filters */}
        <div className="cat-filters">
          <div className="cat-search-wrap">
            <Search size={15} className="cat-search-icon" />
            <input
              className="cat-search"
              placeholder="Search tiger ID (e.g. PTR-T-001)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="catalogue-search"
            />
            {search && <button className="cat-search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
          </div>
          <div className="cat-filter-row">
            <div className="cat-status-tabs">
              {STATUS_TABS.map(s => (
                <button
                  key={s}
                  className={`cat-status-tab ${statusFilter === s ? 'cat-status-tab--active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="cat-select-wrap">
              <select className="cat-select" value={sexFilter} onChange={e => setSexFilter(e.target.value)}>
                <option value="All">All Sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <ChevronDown size={12} className="cat-select-icon" />
            </div>
          </div>
        </div>

        {/* Tiger List */}
        <div className="cat-list">
          {filtered.length === 0 && (
            <div className="cat-empty">
              <Eye size={32} opacity={0.3} />
              <p>No tigers found</p>
            </div>
          )}
          {filtered.map((tiger, i) => (
            <div
              key={tiger.id}
              className={`cat-row ${selected?.id === tiger.id ? 'cat-row--active' : ''}`}
              onClick={() => { setSelected(tiger); setDetailTab('Overview'); }}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Photo */}
              <div className="cat-row-photo-wrap">
                <img
                  src={tiger.image}
                  alt={tiger.id}
                  className="cat-row-photo"
                  loading="lazy"
                />
                <span className={`cat-row-status-dot cat-row-status-dot--${tiger.status}`} />
              </div>

              {/* Info */}
              <div className="cat-row-info">
                <div className="cat-row-top">
                  <span className="cat-row-id font-mono font-bold">{tiger.id}</span>
                  <span className={`cat-row-conf font-mono`} style={{ color: confColor(tiger.confidence) }}>
                    {tiger.confidence > 0 ? `${tiger.confidence}%` : '—'}
                  </span>
                </div>
                <div className="cat-row-meta">
                  <span>{tiger.sex}</span>
                  <span className="cat-meta-dot">·</span>
                  <span>{tiger.zone} Zone</span>
                  <span className="cat-meta-dot">·</span>
                  <span>{tiger.captures} captures</span>
                </div>
              </div>

              {/* Last seen */}
              <div className="cat-row-last">
                <Clock size={12} />
                {tiger.lastSeen}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ── */}
      {selected && (
        <div className="cat-detail-panel">

          {/* Hero photo */}
          <div className="cat-detail-photo-wrap">
            <img src={selected.image} alt={selected.id} className="cat-detail-photo" />
            <div className="cat-detail-photo-overlay">
              <div className="cat-detail-photo-badges">
                <Badge variant={selected.status}>{selected.status}</Badge>
                <Badge variant="default">{selected.sex}</Badge>
                {selected.verified && (
                  <span className="cat-verified-badge">
                    <CheckCircle size={11} /> Verified
                  </span>
                )}
              </div>
              <div className="cat-detail-photo-actions">
                <button className="cat-photo-action-btn" title="View full image">
                  <ExternalLink size={14} />
                </button>
                <button className="cat-photo-action-btn" title="Download">
                  <Download size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Identity header */}
          <div className="cat-detail-identity">
            <div>
              <h2 className="cat-detail-id font-mono text-accent-gradient" style={{ fontSize: '24px', fontWeight: 700 }}>{selected.id}</h2>
              <span className="cat-detail-age">{selected.age} · {selected.zone} Zone</span>
            </div>
            <div className="cat-conf-score">
              <div className="cat-conf-label">Identity confidence</div>
              <div className="cat-conf-value" style={{ color: confColor(selected.identityConf) }}>
                {selected.identityConf > 0 ? `${selected.identityConf}%` : 'Pending'}
              </div>
              <div className="cat-conf-bar-bg">
                <div
                  className="cat-conf-bar-fill"
                  style={{
                    width: `${selected.identityConf}%`,
                    background: confColor(selected.identityConf),
                  }}
                />
              </div>
              <div className="cat-conf-model">{selected.model}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="cat-detail-tabs">
            {DETAIL_TABS.map(t => (
              <button
                key={t}
                className={`cat-detail-tab ${detailTab === t ? 'cat-detail-tab--active' : ''}`}
                onClick={() => setDetailTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="cat-detail-body">

            {/* ── Overview ── */}
            {detailTab === 'Overview' && (
              <>
                <div className="cat-stats-grid">
                  {[
                    { label: 'First captured',  value: selected.firstCaptured, icon: Calendar },
                    { label: 'Last captured',   value: selected.lastCaptured,  icon: Calendar },
                    { label: 'Total captures',  value: selected.captures,      icon: Camera   },
                    { label: 'Stations visited',value: selected.stations,       icon: MapPin   },
                    { label: 'Est. home range', value: selected.range,          icon: Activity },
                    { label: 'Core activity',   value: selected.core,           icon: Shield   },
                  ].map(({ label, value, icon: Icon }) => (
                    <div className="cat-stat-item" key={label}>
                      <div className="cat-stat-label">
                        <Icon size={12} />
                        {label}
                      </div>
                      <div className="cat-stat-value font-mono">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Recent captures thumbnails */}
                {selected.captures_list.length > 0 && (
                  <div className="cat-recent-section">
                    <div className="cat-section-label">Recent detections</div>
                    <div className="cat-recent-list">
                      {selected.captures_list.map((c, i) => (
                        <div className="cat-recent-item" key={i}>
                          <img src={selected.image} alt="capture" className="cat-recent-thumb" />
                          <div className="cat-recent-info">
                            <span className="cat-recent-station font-mono">{c.station}</span>
                            <span className="cat-recent-date">{c.date}</span>
                            <span className="cat-recent-conf font-mono" style={{ color: confColor(c.confidence) }}>
                              {c.confidence}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Capture History ── */}
            {detailTab === 'Capture History' && (
              <div className="cat-capture-history">
                {selected.captures_list.length === 0 ? (
                  <div className="cat-empty">
                    <Camera size={28} opacity={0.3} />
                    <p>No captures recorded yet</p>
                  </div>
                ) : (
                  <table className="cat-capture-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Station</th>
                        <th>Date & Time</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.captures_list.map((c, i) => (
                        <tr key={i}>
                          <td>
                            <img src={selected.image} alt="" className="cat-capture-thumb" />
                          </td>
                          <td><span className="font-mono" style={{ color: 'var(--accent)' }}>{c.station}</span></td>
                          <td><span style={{ color: 'var(--fg-secondary)', fontSize: '12px' }}>{c.date}</span></td>
                          <td>
                            <span className="font-mono" style={{ color: confColor(c.confidence), fontSize: '13px', fontWeight: 600 }}>
                              {c.confidence}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Identity Evidence ── */}
            {detailTab === 'Identity Evidence' && (
              <div className="cat-identity-evidence">
                <div className="cat-evidence-section">
                  <div className="cat-section-label">Flank comparison</div>
                  <div className="cat-flanks">
                    <div className="cat-flank">
                      <img src={selected.leftFlank} alt="Left flank" className="cat-flank-img" />
                      <span className="cat-flank-label">Left flank (reference)</span>
                    </div>
                    <div className="cat-flank">
                      <img src={selected.rightFlank} alt="Right flank" className="cat-flank-img" />
                      <span className="cat-flank-label">Right flank (latest)</span>
                    </div>
                  </div>
                </div>
                <div className="cat-evidence-meta">
                  <div className="cat-section-label" style={{ marginBottom: '10px' }}>Match details</div>
                  {[
                    { label: 'Match confidence', value: `${selected.identityConf}%`, color: confColor(selected.identityConf) },
                    { label: 'Detection quality', value: selected.verified ? 'Excellent' : 'Review needed' },
                    { label: 'Flank captured', value: 'Left & Right' },
                    { label: 'Model', value: selected.model },
                    { label: 'Auto-matched', value: selected.verified ? 'Yes' : 'Pending manual review' },
                  ].map(({ label, value, color }) => (
                    <div className="cat-meta-row" key={label}>
                      <span className="cat-meta-key">{label}</span>
                      <span className="cat-meta-val font-mono" style={{ color: color || 'var(--fg-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <div className="cat-modal-backdrop" onClick={() => setShowUpload(false)}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3 className="cat-modal-title">Add New Tiger</h3>
              <button className="cat-modal-close" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleUploadSubmit} className="cat-modal-body">

              {/* Photo Upload */}
              <div
                className={`cat-upload-zone ${uploadData.preview ? 'cat-upload-zone--filled' : ''}`}
                onClick={() => fileRef.current.click()}
              >
                {uploadData.preview ? (
                  <>
                    <img src={uploadData.preview} alt="Preview" className="cat-upload-preview" />
                    <div className="cat-upload-replace">
                      <Upload size={14} /> Replace photo
                    </div>
                  </>
                ) : (
                  <>
                    <Camera size={32} className="cat-upload-icon" />
                    <p className="cat-upload-title">Upload camera-trap photo</p>
                    <p className="cat-upload-sub">Click to browse · JPG, PNG, WEBP up to 20MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {/* Fields */}
              <div className="cat-form-grid">
                <div className="cat-form-group cat-form-group--full">
                  <label className="cat-form-label">Tiger ID</label>
                  <input
                    className="cat-form-input font-mono"
                    placeholder="e.g. PTR-T-025"
                    value={uploadData.id}
                    onChange={e => setUploadData(d => ({ ...d, id: e.target.value }))}
                    required
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Sex</label>
                  <div className="cat-select-wrap">
                    <select className="cat-form-input cat-form-select" value={uploadData.sex} onChange={e => setUploadData(d => ({ ...d, sex: e.target.value }))}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                    <ChevronDown size={12} className="cat-select-icon" />
                  </div>
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Zone</label>
                  <div className="cat-select-wrap">
                    <select className="cat-form-input cat-form-select" value={uploadData.zone} onChange={e => setUploadData(d => ({ ...d, zone: e.target.value }))}>
                      <option>Core</option>
                      <option>Buffer</option>
                      <option>Village-adjacent</option>
                    </select>
                    <ChevronDown size={12} className="cat-select-icon" />
                  </div>
                </div>
              </div>

              <div className="cat-modal-footer">
                <button type="button" className="cat-btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="cat-btn-primary">
                  <Plus size={15} /> Enroll Tiger ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
