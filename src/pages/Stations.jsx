import React, { useState, useRef } from 'react';
import {
  Search, Filter, Plus, MapPin, Wifi, WifiOff,
  Camera, ChevronDown, AlertTriangle, Battery, Clock,
  RefreshCw, Upload, Download, Edit2, MoreHorizontal,
  CheckCircle, XCircle, X, Check, Save, Info
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import './Stations.css';

const INITIAL_STATIONS = [
  { id: 'ST-42', name: 'Kohka Ridge', zone: 'Core',   lat: 21.7821, lng: 79.3342, status: 'active',   lastImage: '17 Aug, 14:32', captures: 2380, battery: 92, malfunction: false },
  { id: 'ST-18', name: 'Turia Gate',  zone: 'Buffer', lat: 21.7540, lng: 79.3710, status: 'active',   lastImage: '17 Aug, 12:11', captures: 1940, battery: 78, malfunction: false },
  { id: 'ST-37', name: 'Rukhad Nala', zone: 'Core',   lat: 21.7130, lng: 79.4120, status: 'active',   lastImage: '17 Aug, 10:05', captures: 3110, battery: 85, malfunction: false },
  { id: 'ST-09', name: 'Pench Core',  zone: 'Core',   lat: 21.7280, lng: 79.3580, status: 'active',   lastImage: '17 Aug, 09:12', captures: 1860, battery: 64, malfunction: false },
  { id: 'ST-12', name: 'Bison Point', zone: 'Core',   lat: 21.7650, lng: 79.3200, status: 'active',   lastImage: '17 Aug, 06:20', captures: 2540, battery: 71, malfunction: false },
  { id: 'ST-24', name: 'Saja Plain',  zone: 'Buffer', lat: 21.7420, lng: 79.3950, status: 'active',   lastImage: '16 Aug, 22:40', captures:  920, battery: 55, malfunction: false },
  { id: 'ST-06', name: 'River Bed W', zone: 'Core',   lat: 21.7700, lng: 79.4400, status: 'active',   lastImage: '16 Aug, 21:15', captures: 1670, battery: 48, malfunction: false },
  { id: 'ST-63', name: 'Bamboo Ghat', zone: 'Buffer', lat: 21.7900, lng: 79.3650, status: 'active',   lastImage: '16 Aug, 18:30', captures:  750, battery: 90, malfunction: false },
  { id: 'ST-49', name: 'Teak Slope',  zone: 'Buffer', lat: 21.7060, lng: 79.3310, status: 'inactive', lastImage: '10 Aug, 08:20', captures:  480, battery: 22, malfunction: false },
  { id: 'ST-55', name: 'Crow Hill',   zone: 'Core',   lat: 21.7340, lng: 79.4550, status: 'inactive', lastImage: '05 Aug, 14:10', captures: 1120, battery: 15, malfunction: false },
  { id: 'ST-31', name: 'North Buffer',zone: 'Buffer', lat: 21.8200, lng: 79.3100, status: 'malfunction',lastImage:'02 Aug, 11:00',captures: 640,  battery: 0,  malfunction: true  },
];

const ZONE_COLOR = { Core: 'var(--color-success)', Buffer: 'var(--color-warning)', 'Village-adjacent': 'var(--color-danger)' };

function BatteryBar({ pct }) {
  const color = pct > 50 ? 'var(--color-success)' : pct > 20 ? 'var(--color-warning)' : 'var(--color-danger)';
  return (
    <div className="battery-bar" title={`Camera Trap Battery Level: ${pct}%`}>
      <div className="battery-bar-bg">
        <div className="battery-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="battery-pct font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function Stations() {
  const [stations, setStations] = useState(INITIAL_STATIONS);
  const [search, setSearch] = useState('');
  const [zoneF, setZoneF] = useState('All');
  const [statusF, setStatusF] = useState('All');
  const [selected, setSelected] = useState(INITIAL_STATIONS[0]);
  
  // Modals & States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Add Form State
  const [newStation, setNewStation] = useState({
    id: `ST-${Math.floor(Math.random() * 80 + 20)}`,
    name: '',
    zone: 'Core',
    status: 'active',
    lat: 21.7500,
    lng: 79.3500,
    battery: 100,
    captures: 0
  });

  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = stations.filter(s => {
    const ms = s.id.toLowerCase().includes(search.toLowerCase()) ||
               s.name.toLowerCase().includes(search.toLowerCase());
    const mz = zoneF === 'All' || s.zone === zoneF;
    const mst = statusF === 'All' || s.status === statusF;
    return ms && mz && mst;
  });

  const online = stations.filter(s => s.status === 'active').length;
  const broken = stations.filter(s => s.status === 'malfunction').length;

  // Add Station
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newStation.name) return;
    const stationToAdd = {
      ...newStation,
      lastImage: 'Just now',
      malfunction: newStation.status === 'malfunction'
    };
    setStations([stationToAdd, ...stations]);
    setSelected(stationToAdd);
    setShowAddModal(false);
    showToast(`✓ Station ${stationToAdd.id} (${stationToAdd.name}) added successfully!`);
    setNewStation({
      id: `ST-${Math.floor(Math.random() * 80 + 20)}`,
      name: '',
      zone: 'Core',
      status: 'active',
      lat: 21.7500,
      lng: 79.3500,
      battery: 100,
      captures: 0
    });
  };

  // Edit Station
  const handleOpenEdit = (stn, e) => {
    e?.stopPropagation();
    setEditingStation({ ...stn });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingStation) return;
    setStations(stations.map(s => s.id === editingStation.id ? editingStation : s));
    if (selected?.id === editingStation.id) setSelected(editingStation);
    setShowEditModal(false);
    showToast(`✓ Station ${editingStation.id} updated!`);
  };

  // Force Sync
  const handleForceSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      const updated = stations.map(s => 
        s.id === selected?.id ? { ...s, lastImage: 'Just now' } : s
      );
      setStations(updated);
      setSelected(prev => ({ ...prev, lastImage: 'Just now' }));
      showToast(`✓ Station ${selected?.id} heartbeat synced with cloud!`);
    }, 1000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'ID,Name,Zone,Status,Battery,LastImage,TotalCaptures,Latitude,Longitude\n';
    const rows = stations.map(s => 
      `"${s.id}","${s.name}","${s.zone}","${s.status}",${s.battery}%,"${s.lastImage}",${s.captures},${s.lat},${s.lng}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tigerwatch_camera_stations_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Camera stations CSV downloaded!');
  };

  // Import CSV trigger
  const handleCSVImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showToast(`✓ Importing stations from ${file.name}…`);
    setTimeout(() => {
      showToast(`✓ Imported records from ${file.name} successfully!`);
    }, 1000);
  };

  return (
    <div className="stations-page">
      {/* Hidden File Input for CSV Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="stations-toast font-mono">
          {toastMessage}
        </div>
      )}

      {/* ── Header ── */}
      <div className="stations-topbar">
        <div>
          <h1 className="stations-title">Camera Stations</h1>
          <p className="stations-sub">
            <span style={{ color: 'var(--color-success)' }}>● {online} online</span>
            &nbsp;·&nbsp;
            <span style={{ color: 'var(--color-absent)' }}>{stations.length - online - broken} inactive</span>
            &nbsp;·&nbsp;
            {broken > 0 && <span style={{ color: 'var(--color-danger)' }}>⚠ {broken} malfunction</span>}
          </p>
        </div>
        <div className="stations-actions">
          <button className="cat-btn-secondary stn-btn" onClick={handleCSVImportClick}>
            <Upload size={14}/> Import CSV
          </button>
          <button className="cat-btn-primary stn-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={14}/> Add Station
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="stations-filters">
        <div className="cat-search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <Search size={15} className="cat-search-icon" />
          <input
            className="cat-search"
            placeholder="Search station ID or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {['All', 'Core', 'Buffer'].map(z => (
          <button
            key={z}
            className={`stn-filter-btn ${zoneF === z ? 'stn-filter-btn--active' : ''}`}
            onClick={() => setZoneF(z)}
          >
            {z}
          </button>
        ))}
        <div className="cat-select-wrap">
          <select
            className="cat-select"
            value={statusF}
            onChange={e => setStatusF(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="malfunction">Malfunction</option>
          </select>
          <ChevronDown size={12} className="cat-select-icon"/>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="stations-table-wrap">
        <table className="stations-table">
          <thead>
            <tr>
              <th>Station</th>
              <th>Zone</th>
              <th>Status</th>
              <th>Last Image</th>
              <th>Total Captures</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Battery</span>
                  <span title="Camera Trap Battery charge remaining. Forest units dispatch maintenance when under 20%." style={{ cursor: 'help', opacity: 0.6 }}>
                    <Info size={12} />
                  </span>
                </div>
              </th>
              <th>GPS</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr
                key={s.id}
                className={`stn-row ${selected?.id === s.id ? 'stn-row--active' : ''}`}
                onClick={() => setSelected(s)}
              >
                <td>
                  <div className="stn-cell-name">
                    <div className="stn-icon" style={{ color: ZONE_COLOR[s.zone] }}>
                      <Camera size={14}/>
                    </div>
                    <div>
                      <div className="font-mono stn-id">{s.id}</div>
                      <div className="stn-name-text">{s.name}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="stn-zone-badge"
                    style={{
                      color: ZONE_COLOR[s.zone],
                      background: `${ZONE_COLOR[s.zone]}18`,
                      borderColor: `${ZONE_COLOR[s.zone]}30`
                    }}
                  >
                    {s.zone}
                  </span>
                </td>
                <td>
                  {s.status === 'active' && <Badge variant="active" dot>Online</Badge>}
                  {s.status === 'inactive' && <Badge variant="absent" dot>Offline</Badge>}
                  {s.status === 'malfunction' && <Badge variant="danger" dot>Fault</Badge>}
                </td>
                <td><span className="stn-text-sm font-mono">{s.lastImage}</span></td>
                <td><span className="stn-text-sm font-mono">{s.captures.toLocaleString()}</span></td>
                <td><BatteryBar pct={s.battery}/></td>
                <td><span className="stn-text-xs font-mono">{s.lat.toFixed(4)}°N<br/>{s.lng.toFixed(4)}°E</span></td>
                <td>
                  <button
                    className="stn-action-icon"
                    title="Edit Station"
                    onClick={(e) => handleOpenEdit(s, e)}
                  >
                    <Edit2 size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Drawer ── */}
      {selected && (
        <div className="stn-detail-drawer">
          <div className="stn-detail-header">
            <div>
              <span className="font-mono stn-detail-id">{selected.id}</span>
              <h3 className="stn-detail-name">{selected.name}</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="cat-btn-secondary stn-btn"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={(e) => handleOpenEdit(selected, e)}
              >
                <Edit2 size={12}/> Edit
              </button>
              <button className="cat-modal-close" onClick={() => setSelected(null)}>
                <XCircle size={18}/>
              </button>
            </div>
          </div>
          <div className="stn-detail-body">
            {[
              { label: 'Zone', value: selected.zone },
              { label: 'Status', value: selected.status },
              { label: 'Battery Level', value: `${selected.battery}% (${selected.battery < 20 ? 'Action required' : 'Operational'})` },
              { label: 'Last image', value: selected.lastImage },
              { label: 'Total captures', value: selected.captures.toLocaleString() },
              { label: 'Coordinates', value: `${selected.lat.toFixed(4)}°N, ${selected.lng.toFixed(4)}°E` },
            ].map(({ label, value }) => (
              <div className="stn-detail-row" key={label}>
                <span className="stn-detail-label">{label}</span>
                <span className="stn-detail-value font-mono">{value}</span>
              </div>
            ))}
            <div className="stn-detail-actions">
              <button
                className="cat-btn-secondary stn-btn"
                onClick={handleForceSync}
                disabled={syncing}
              >
                <RefreshCw size={13} className={syncing ? 'stage-spin-ring' : ''}/>
                {syncing ? 'Syncing…' : 'Force Sync'}
              </button>
              <button className="cat-btn-secondary stn-btn" onClick={handleExportCSV}>
                <Download size={13}/> Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD STATION MODAL ── */}
      {showAddModal && (
        <div className="cat-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3 className="cat-modal-title">Add Camera Trap Station</h3>
              <button className="cat-modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="cat-modal-body">
              <div className="cat-form-grid">
                <div className="cat-form-group">
                  <label className="cat-form-label">Station ID</label>
                  <input
                    className="cat-form-input font-mono"
                    value={newStation.id}
                    onChange={e => setNewStation({ ...newStation, id: e.target.value })}
                    required
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Location / Landmark Name</label>
                  <input
                    className="cat-form-input"
                    placeholder="e.g. Mahua Trail Ridge"
                    value={newStation.name}
                    onChange={e => setNewStation({ ...newStation, name: e.target.value })}
                    required
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Forest Zone</label>
                  <select
                    className="cat-form-input cat-form-select"
                    value={newStation.zone}
                    onChange={e => setNewStation({ ...newStation, zone: e.target.value })}
                  >
                    <option value="Core">Core Zone</option>
                    <option value="Buffer">Buffer Zone</option>
                    <option value="Village-adjacent">Village-adjacent</option>
                  </select>
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Initial Status</label>
                  <select
                    className="cat-form-input cat-form-select"
                    value={newStation.status}
                    onChange={e => setNewStation({ ...newStation, status: e.target.value })}
                  >
                    <option value="active">Active (Online)</option>
                    <option value="inactive">Inactive (Offline)</option>
                    <option value="malfunction">Malfunction (Fault)</option>
                  </select>
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">GPS Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="cat-form-input font-mono"
                    value={newStation.lat}
                    onChange={e => setNewStation({ ...newStation, lat: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">GPS Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="cat-form-input font-mono"
                    value={newStation.lng}
                    onChange={e => setNewStation({ ...newStation, lng: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="cat-form-group cat-form-group--full">
                  <label className="cat-form-label">Initial Battery (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="cat-form-input font-mono"
                    value={newStation.battery}
                    onChange={e => setNewStation({ ...newStation, battery: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="cat-modal-footer">
                <button type="button" className="cat-btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cat-btn-primary" disabled={!newStation.name}>
                  <Plus size={15} /> Save & Deploy Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT STATION MODAL ── */}
      {showEditModal && editingStation && (
        <div className="cat-modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3 className="cat-modal-title">Edit Station {editingStation.id}</h3>
              <button className="cat-modal-close" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="cat-modal-body">
              <div className="cat-form-grid">
                <div className="cat-form-group">
                  <label className="cat-form-label">Station ID</label>
                  <input className="cat-form-input font-mono" value={editingStation.id} disabled />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Name</label>
                  <input
                    className="cat-form-input"
                    value={editingStation.name}
                    onChange={e => setEditingStation({ ...editingStation, name: e.target.value })}
                    required
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Forest Zone</label>
                  <select
                    className="cat-form-input cat-form-select"
                    value={editingStation.zone}
                    onChange={e => setEditingStation({ ...editingStation, zone: e.target.value })}
                  >
                    <option value="Core">Core Zone</option>
                    <option value="Buffer">Buffer Zone</option>
                    <option value="Village-adjacent">Village-adjacent</option>
                  </select>
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Operating Status</label>
                  <select
                    className="cat-form-input cat-form-select"
                    value={editingStation.status}
                    onChange={e => setEditingStation({ ...editingStation, status: e.target.value })}
                  >
                    <option value="active">Active (Online)</option>
                    <option value="inactive">Inactive (Offline)</option>
                    <option value="malfunction">Malfunction (Fault)</option>
                  </select>
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Battery Level (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="cat-form-input font-mono"
                    value={editingStation.battery}
                    onChange={e => setEditingStation({ ...editingStation, battery: parseInt(e.target.value) })}
                  />
                </div>
                <div className="cat-form-group">
                  <label className="cat-form-label">Total Captures</label>
                  <input
                    type="number"
                    className="cat-form-input font-mono"
                    value={editingStation.captures}
                    onChange={e => setEditingStation({ ...editingStation, captures: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="cat-modal-footer">
                <button type="button" className="cat-btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cat-btn-primary">
                  <Save size={15} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
