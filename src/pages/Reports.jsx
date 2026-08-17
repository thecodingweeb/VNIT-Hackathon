import React, { useState } from 'react';
import {
  FileText, Download, Calendar, Filter,
  Share2, CheckCircle, Clock, Shield,
  BarChart3, Camera, AlertTriangle, MapPin, Printer,
  Eye, Check, ChevronRight, Info, Compass, Layers, Activity
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { getStoredTigers } from '../lib/tigerStorage';
import './Reports.css';

/* ══════════════════════════════════════════════════════════════════
   COMPREHENSIVE TIGER POPULATION DATASET (ID-BASED)
   ══════════════════════════════════════════════════════════════════ */
const ALL_TIGERS_DATA = [
  {
    id: 'PTR-T-001',
    sex: 'Male',
    status: 'Active',
    zone: 'Core Zone',
    captures: 148,
    age: '6–8 yrs',
    firstSeen: '12 Jan 2024',
    lastSeen: '17 Aug 2026, 14:32',
    station: 'ST-42 (Kohka Ridge)',
    range: '42.6 km²',
    core: '11.8 km²',
    confidence: '97.2%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_hero.jpg',
    rightFlank: '/images/tiger_2.jpg',
    territoryOverlap: 'PTR-T-007 (14%), PTR-T-014 (32%)',
    centroid: '21.782° N, 79.334° E',
    notes: 'Dominant breeding male in northern Kohka sector. Stable territorial boundaries.',
    recentCaptures: [
      { date: '17 Aug 2026, 14:32', station: 'ST-42 (Kohka Ridge)', zone: 'Core Zone', conf: '97.2%' },
      { date: '12 Aug 2026, 11:11', station: 'ST-18 (Turia Gate)', zone: 'Buffer Zone', conf: '94.8%' },
      { date: '08 Aug 2026, 10:05', station: 'ST-37 (Rukhad Nala)', zone: 'Core Zone', conf: '92.1%' },
      { date: '03 Aug 2026, 19:40', station: 'ST-09 (Pench Core)', zone: 'Core Zone', conf: '96.5%' },
    ]
  },
  {
    id: 'PTR-T-007',
    sex: 'Male',
    status: 'Active',
    zone: 'Core Zone',
    captures: 96,
    age: '5–7 yrs',
    firstSeen: '03 Mar 2024',
    lastSeen: '16 Aug 2026, 09:45',
    station: 'ST-16 (River West)',
    range: '38.1 km²',
    core: '9.4 km²',
    confidence: '91.2%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_2.jpg',
    rightFlank: '/images/tiger_hero.jpg',
    territoryOverlap: 'PTR-T-001 (14%), PTR-T-041 (18%)',
    centroid: '21.760° N, 79.380° E',
    notes: 'Western river corridor individual. Frequent movement along perennial stream beds.',
    recentCaptures: [
      { date: '16 Aug 2026, 09:45', station: 'ST-16 (River West)', zone: 'Core Zone', conf: '91.2%' },
      { date: '10 Aug 2026, 17:30', station: 'ST-22 (Saja Basin)', zone: 'Core Zone', conf: '88.4%' },
      { date: '04 Aug 2026, 07:15', station: 'ST-06 (River Bed W)', zone: 'Core Zone', conf: '93.0%' },
    ]
  },
  {
    id: 'PTR-T-014',
    sex: 'Female',
    status: 'Active',
    zone: 'Core Zone',
    captures: 106,
    age: '4–6 yrs',
    firstSeen: '12 Jan 2024',
    lastSeen: '17 Aug 2026, 14:32',
    station: 'ST-42 (Kohka Ridge)',
    range: '42.8 km²',
    core: '11.8 km²',
    confidence: '94.8%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_hero.jpg',
    rightFlank: '/images/tiger_3.jpg',
    territoryOverlap: 'PTR-T-001 (32%), PTR-T-095 (9%)',
    centroid: '21.775° N, 79.340° E',
    notes: 'Resident tigress with documented litter of 2 cubs in Kohka plateau.',
    recentCaptures: [
      { date: '17 Aug 2026, 14:32', station: 'ST-42 (Kohka Ridge)', zone: 'Core Zone', conf: '94.8%' },
      { date: '11 Aug 2026, 21:04', station: 'ST-37 (Rukhad Nala)', zone: 'Core Zone', conf: '91.7%' },
      { date: '06 Aug 2026, 05:48', station: 'ST-12 (Bison Point)', zone: 'Core Zone', conf: '95.1%' },
    ]
  },
  {
    id: 'PTR-T-021',
    sex: 'Female',
    status: 'Provisional',
    zone: 'Buffer Zone',
    captures: 41,
    age: '3–5 yrs',
    firstSeen: '19 Jun 2025',
    lastSeen: '15 Aug 2026, 09:12',
    station: 'ST-09 (Pench Core)',
    range: '22.3 km²',
    core: '5.1 km²',
    confidence: '72.4%',
    verified: 'Under Review',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_3.jpg',
    rightFlank: '/images/tiger_2.jpg',
    territoryOverlap: 'PTR-T-095 (21%)',
    centroid: '21.728° N, 79.358° E',
    notes: 'Sub-adult dispersing into southern buffer sector. Flagged for manual review.',
    recentCaptures: [
      { date: '15 Aug 2026, 09:12', station: 'ST-09 (Pench Core)', zone: 'Buffer Zone', conf: '72.4%' },
      { date: '02 Aug 2026, 18:20', station: 'ST-18 (Turia Gate)', zone: 'Buffer Zone', conf: '69.8%' },
    ]
  },
  {
    id: 'PTR-T-041',
    sex: 'Male',
    status: 'Active',
    zone: 'Core Zone',
    captures: 184,
    age: '8–10 yrs',
    firstSeen: '07 Nov 2023',
    lastSeen: '14 Aug 2026, 06:20',
    station: 'ST-12 (Bison Point)',
    range: '55.2 km²',
    core: '14.2 km²',
    confidence: '88.3%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_4.jpg',
    rightFlank: '/images/tiger_hero.jpg',
    territoryOverlap: 'PTR-T-007 (18%), PTR-T-003 (24%)',
    centroid: '21.765° N, 79.320° E',
    notes: 'Largest recorded home range in reserve. Highly active nocturnal patrols.',
    recentCaptures: [
      { date: '14 Aug 2026, 06:20', station: 'ST-12 (Bison Point)', zone: 'Core Zone', conf: '88.3%' },
      { date: '11 Aug 2026, 20:14', station: 'ST-07 (Teak Ridge)', zone: 'Core Zone', conf: '85.1%' },
      { date: '05 Aug 2026, 23:50', station: 'ST-37 (Rukhad Nala)', zone: 'Core Zone', conf: '89.4%' },
    ]
  },
  {
    id: 'PTR-T-095',
    sex: 'Female',
    status: 'Active',
    zone: 'Buffer Zone',
    captures: 73,
    age: '4–6 yrs',
    firstSeen: '22 Feb 2025',
    lastSeen: '08 Aug 2026, 21:55',
    station: 'ST-33 (Bamboo Ghat)',
    range: '28.9 km²',
    core: '6.8 km²',
    confidence: '79.1%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_5.jpg',
    rightFlank: '/images/tiger_2.jpg',
    territoryOverlap: 'PTR-T-021 (21%), PTR-T-014 (9%)',
    centroid: '21.790° N, 79.365° E',
    notes: 'Frequent movement along eastern buffer corridor and Bamboo Ghat waterholes.',
    recentCaptures: [
      { date: '08 Aug 2026, 21:55', station: 'ST-33 (Bamboo Ghat)', zone: 'Buffer Zone', conf: '79.1%' },
      { date: '31 Jul 2026, 04:12', station: 'ST-24 (Saja Plain)', zone: 'Buffer Zone', conf: '81.0%' },
    ]
  },
  {
    id: 'PTR-T-003',
    sex: 'Male',
    status: 'Absent',
    zone: 'Core Zone',
    captures: 130,
    age: '7–9 yrs',
    firstSeen: '14 Sep 2023',
    lastSeen: '01 Aug 2026, 11:20',
    station: 'ST-12 (Bison Point)',
    range: '47.8 km²',
    core: '12.1 km²',
    confidence: '65.2%',
    verified: 'Yes (Verified)',
    model: 'Siamese-CNN v1.2',
    leftFlank: '/images/tiger_hero.jpg',
    rightFlank: '/images/tiger_3.jpg',
    territoryOverlap: 'PTR-T-041 (24%)',
    centroid: '21.750° N, 79.310° E',
    notes: 'No detection across primary grid in >16 days. Patrol alert dispatched.',
    recentCaptures: [
      { date: '01 Aug 2026, 11:20', station: 'ST-12 (Bison Point)', zone: 'Core Zone', conf: '65.2%' },
      { date: '25 Jul 2026, 16:40', station: 'ST-06 (River Bed W)', zone: 'Core Zone', conf: '74.3%' },
    ]
  },
];

/* ══════════════════════════════════════════════════════════════════
   REPORT TEMPLATE DEFINITIONS & METRICS
   ══════════════════════════════════════════════════════════════════ */
const REPORT_TEMPLATES = [
  {
    id: 'reserve-activity',
    title: 'Reserve Activity Report',
    desc: 'Overview of seasonal activity, unique tiger detections & capture frequency across Pench TR.',
    icon: BarChart3,
    period: 'Monsoon 2026',
    generatedDate: '17 Aug 2026',
    format: 'PDF, CSV, GeoJSON',
    stats: [
      { label: 'Tracked Individuals', value: '37 Tigers', sub: '100% Stripe ID verified', color: 'accent' },
      { label: 'Total Ingested Frames', value: '12,480', sub: '94.2% classified by AI', color: 'default' },
      { label: 'High Priority Alerts', value: '3 Alerts', sub: 'Buffer approaches', color: 'danger' },
      { label: 'Operational Stations', value: '58 / 64', sub: '90.6% network uptime', color: 'success' },
    ],
    summaryNote: 'High seasonal tiger movement recorded around perennial water sources and Kohka Ridge during Monsoon 2026.'
  },
  {
    id: 'movement-analysis',
    title: 'Tiger Movement & Range Report',
    desc: 'Spatial centroid shifts, KDE 95% home range analysis & core territory overlap metrics.',
    icon: MapPin,
    period: 'Last 30 Days',
    generatedDate: '17 Aug 2026',
    format: 'PDF, GeoJSON',
    stats: [
      { label: 'Avg Home Range (KDE 95%)', value: '39.8 km²', sub: 'Core average 10.2 km²', color: 'accent' },
      { label: 'Territory Overlap Index', value: '18.4%', sub: 'Moderate spatial competition', color: 'default' },
      { label: 'Centroid Shifts > 5km', value: '2 Tigers', sub: 'PTR-T-041, PTR-T-021', color: 'warning' },
      { label: 'Active Movement Corridors', value: '8 Corridors', sub: 'Pench River & Teak Slopes', color: 'success' },
    ],
    summaryNote: 'Spatial kernel density estimates show northward expansion along River Bed West with minor border tension in Kohka sector.'
  },
  {
    id: 'alert-digest',
    title: 'Perimeter & Alert Digest',
    desc: 'Summary of buffer zone approaches, novel stations & human-wildlife conflict warnings.',
    icon: AlertTriangle,
    period: 'Weekly Digest',
    generatedDate: '17 Aug 2026',
    format: 'PDF, CSV',
    stats: [
      { label: 'Active Perimeter Alerts', value: '3 High', sub: 'Immediate ranger response', color: 'danger' },
      { label: 'Novel Station Detections', value: '4 Logs', sub: 'New territorial markers', color: 'warning' },
      { label: 'Village Boundary Proximity', value: '4.8 km', sub: 'Closest approach (Turia)', color: 'default' },
      { label: 'Conflict Incidents', value: '0 Reported', sub: 'Early deterrent active', color: 'success' },
    ],
    summaryNote: 'Automated perimeter tripwires successfully alerted patrol units near Turia buffer gate, preventing human-tiger contact.'
  },
  {
    id: 'station-health',
    title: 'Camera Station Health & Battery Audit',
    desc: 'Comprehensive diagnostic log of battery levels, sensor dropouts & maintenance schedules.',
    icon: Camera,
    period: 'Current Status',
    generatedDate: '17 Aug 2026',
    format: 'CSV, JSON',
    stats: [
      { label: 'Online Stations', value: '58 / 64', sub: '90.6% camera trap uptime', color: 'success' },
      { label: 'Low Battery (< 25%)', value: '2 Stations', sub: 'ST-49, ST-55 require swap', color: 'danger' },
      { label: 'Solar Array Efficiency', value: '94.1%', sub: 'Avg daily charge 4.2V', color: 'accent' },
      { label: 'Scheduled Field Visits', value: '3 Stations', sub: 'Maintenance team deployed', color: 'warning' },
    ],
    summaryNote: 'Grid coverage remains optimal. Two solar charging units in Teak Slope scheduled for battery replacement on 19 Aug 2026.'
  },
];

/* Mock Alerts Dataset for Alert Digest Report */
const MOCK_ALERTS_LOG = [
  { id: 'AL-2026-08-17-016', tigerId: 'PTR-T-001', station: 'ST-42 (Kohka)', type: 'Buffer Approach', distance: '4.8 km to village', severity: 'High', date: '17 Aug, 14:32', status: 'Patrol Dispatched' },
  { id: 'AL-2026-08-16-012', tigerId: 'PTR-T-007', station: 'ST-16 (River W)', type: 'Novel Station', distance: '12.3 km to border', severity: 'Medium', date: '16 Aug, 09:45', status: 'Logged' },
  { id: 'AL-2026-08-15-009', tigerId: 'PTR-T-021', station: 'ST-09 (Pench Core)', type: 'Prolonged Absence', distance: '—', severity: 'Low', date: '15 Aug, 09:12', status: 'Observation' },
  { id: 'AL-2026-08-14-007', tigerId: 'PTR-T-041', station: 'ST-12 (Bison Pt)', type: 'Range Shift (+8.2km)', distance: '9.1 km to border', severity: 'High', date: '14 Aug, 06:20', status: 'Verified' },
];

/* Mock Station Health Dataset */
const MOCK_STATIONS_LOG = [
  { id: 'ST-42', name: 'Kohka Ridge', zone: 'Core', battery: '92%', solar: 'Optimal', frames: 2380, status: 'Operational', action: 'None' },
  { id: 'ST-18', name: 'Turia Gate', zone: 'Buffer', battery: '78%', solar: 'Optimal', frames: 1940, status: 'Operational', action: 'None' },
  { id: 'ST-37', name: 'Rukhad Nala', zone: 'Core', battery: '85%', solar: 'Optimal', frames: 3110, status: 'Operational', action: 'None' },
  { id: 'ST-09', name: 'Pench Core', zone: 'Core', battery: '64%', solar: 'Normal', frames: 1860, status: 'Operational', action: 'None' },
  { id: 'ST-12', name: 'Bison Point', zone: 'Core', battery: '71%', solar: 'Normal', frames: 2540, status: 'Operational', action: 'None' },
  { id: 'ST-49', name: 'Teak Slope', zone: 'Buffer', battery: '22%', solar: 'Degraded', frames: 480, status: 'Low Battery', action: 'Battery Swap Scheduled' },
  { id: 'ST-55', name: 'Crow Hill', zone: 'Core', battery: '15%', solar: 'Faulty', frames: 1120, status: 'Low Battery', action: 'Solar Repair Scheduled' },
];

export default function Reports() {
  const [selectedTemplate, setSelectedTemplate] = useState('reserve-activity');
  const [dateRange, setDateRange] = useState('01 Aug - 17 Aug 2026');
  const [allTigers, setAllTigers] = useState(() => getStoredTigers());
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [selectedTiger, setSelectedTiger] = useState('All Tigers');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);
  const [previewTab, setPreviewTab] = useState('web'); // 'web' | 'print-preview'

  // Filtered tiger list based on user selections
  const filteredTigers = (allTigers || []).filter(t => {
    const matchesTiger = selectedTiger === 'All Tigers' || t.id === selectedTiger;
    const tZone = t.zone?.toLowerCase() || '';
    const matchesZone = selectedZone === 'All Zones' ||
      (selectedZone === 'Core Zone Only' && tZone.includes('core')) ||
      (selectedZone === 'Buffer Zone Only' && tZone.includes('buffer')) ||
      (selectedZone === 'Village Perimeter' && tZone.includes('buffer'));
    return matchesTiger && matchesZone;
  });

  const activeTemplate = REPORT_TEMPLATES.find(t => t.id === selectedTemplate) || REPORT_TEMPLATES[0];

  const handleExport = (format) => {
    setExporting(true);

    setTimeout(() => {
      if (format === 'PDF') {
        // Trigger browser print for PDF document generation
        window.print();
        setExporting(false);
        setExportSuccess('PDF Document');
        setTimeout(() => setExportSuccess(null), 4000);
        return;
      }

      if (format === 'CSV') {
        // Generate CSV report file
        const csvContent = [
          '# PENCH TIGER RESERVE - MOVEMENT INTELLIGENCE REPORT',
          `# Report Template: ${activeTemplate.title}`,
          `# Date Range: ${dateRange}`,
          `# Target Tiger: ${selectedTiger}`,
          `# Zone Scope: ${selectedZone}`,
          `# Generated: ${new Date().toLocaleString()}`,
          '',
          'Tiger_ID,Sex,Age,Zone,Status,Home_Range_km2,Core_Territory_km2,Total_Captures,Last_Station,Last_Detected,ReID_Confidence,Verification',
          ...filteredTigers.map(t =>
            `"${t.id}","${t.sex}","${t.age}","${t.zone}","${t.status}",${t.range.replace(' km²','')},${t.core.replace(' km²','')},${t.captures},"${t.station}","${t.lastSeen}","${t.confidence}","${t.verified}"`
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pench_report_${selectedTemplate}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (format === 'GeoJSON') {
        const geojson = {
          type: 'FeatureCollection',
          metadata: {
            reserve: 'Pench Tiger Reserve',
            reportType: activeTemplate.title,
            generated: new Date().toISOString(),
            dateRange,
            zone: selectedZone
          },
          features: filteredTigers.map(t => ({
            type: 'Feature',
            properties: {
              id: t.id,
              range: t.range,
              core: t.core,
              zone: t.zone,
              captures: t.captures,
              lastStation: t.station,
              lastSeen: t.lastSeen
            },
            geometry: {
              type: 'Point',
              coordinates: [79.350 + (Math.random() - 0.5) * 0.1, 21.750 + (Math.random() - 0.5) * 0.1]
            }
          }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pench_spatial_${selectedTemplate}_${new Date().toISOString().slice(0, 10)}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setExporting(false);
      setExportSuccess(format);
      setTimeout(() => setExportSuccess(null), 4000);
    }, 600);
  };

  return (
    <div className="reports-page">
      {/* ══════════════════════════════════════════════════════════════════
          SCREEN UI (Interactive Reports Builder & Live Preview)
         ══════════════════════════════════════════════════════════════════ */}
      <div className="reports-screen-ui">
        {/* Page Header */}
        <div className="reports-header">
          <div>
            <h1 className="reports-title">Reports & Intelligence Exports</h1>
            <p className="reports-subtitle">
              Generate official wildlife census dossiers, spatial movement audits, and compliance printouts
            </p>
          </div>
          <div className="reports-header-actions">
            <button
              className="cat-btn-primary"
              onClick={() => handleExport('PDF')}
              disabled={exporting}
              id="print-export-pdf-top-btn"
            >
              <Printer size={15} />
              <span>{exporting ? 'Preparing Document…' : 'Print / Export Tiger PDF'}</span>
            </button>
          </div>
        </div>

        {/* ── 1. REPORT TEMPLATES ROW ── */}
        <div className="report-templates-section">
          <div className="section-label-row">
            <span className="section-step-num">Step 1</span>
            <span className="section-step-title">Select Intelligence Report Type</span>
            <span className="section-step-hint">Click any module to configure its specific metrics & audit scope</span>
          </div>

          <div className="report-templates-grid">
            {REPORT_TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              const isSelected = selectedTemplate === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`report-template-card ${isSelected ? 'report-template-card--active' : ''}`}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="tpl-card-top">
                    <div className="tpl-icon-wrap">
                      <Icon size={20} />
                    </div>
                    {isSelected && (
                      <span className="tpl-active-badge">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <div className="tpl-info">
                    <h3 className="tpl-title">{tpl.title}</h3>
                    <p className="tpl-desc">{tpl.desc}</p>
                    <div className="tpl-meta font-mono">
                      <span className="tpl-period-tag">{tpl.period}</span>
                      <span className="tpl-format-tag">{tpl.format}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 2. EXPORT CONFIGURATION & PARAMETERS ── */}
        <div className="export-config-card">
          <div className="config-header">
            <div className="config-header-left">
              <FileText size={18} className="config-icon" />
              <div>
                <h3 className="config-title">Report Parameters & Filter Scope</h3>
                <span className="config-subtitle font-mono">Configuring: {activeTemplate.title}</span>
              </div>
            </div>
            <div className="config-header-right">
              <span className="config-scope-badge font-mono">
                {filteredTigers.length} Tiger ID{filteredTigers.length !== 1 ? 's' : ''} in Scope
              </span>
            </div>
          </div>

          <div className="config-grid">
            <div className="form-group">
              <label>Date Range / Observation Period</label>
              <div className="cat-search-wrap">
                <input
                  type="text"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="cat-form-input font-mono"
                  placeholder="e.g. 01 Aug - 17 Aug 2026"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Target Tiger ID (All or Specific Individual)</label>
              <select
                className="cat-form-input cat-form-select"
                value={selectedTiger}
                onChange={(e) => setSelectedTiger(e.target.value)}
              >
                <option value="All Tigers">All Tigers ({allTigers.length} Tracked)</option>
                {allTigers.map(t => (
                  <option key={t.id} value={t.id}>{t.id} ({t.zone})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Zone Sector Scope</label>
              <select
                className="cat-form-input cat-form-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                <option value="All Zones">All Sectors (Core + Buffer)</option>
                <option value="Core Zone Only">Core Sanctuary Area Only</option>
                <option value="Buffer Zone Only">Buffer & Fringe Zones Only</option>
                <option value="Village Perimeter">Village Perimeter Corridor</option>
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div className="export-actions-row">
            <div className="export-feedback">
              {exportSuccess && (
                <span className="export-success-msg font-mono">
                  <CheckCircle size={15} /> Generated & exported <strong>{exportSuccess}</strong> successfully!
                </span>
              )}
            </div>

            <div className="export-btn-group">
              <button
                className="cat-btn-primary"
                onClick={() => handleExport('PDF')}
                disabled={exporting}
                title="Print clean official PDF document without web page layout"
              >
                <Printer size={16} />
                <span>{exporting ? 'Rendering Print Dossier…' : 'Print / Export Tiger PDF'}</span>
              </button>
              <button
                className="cat-btn-secondary"
                onClick={() => handleExport('CSV')}
                disabled={exporting}
                title="Export raw tabular CSV data"
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
              <button
                className="cat-btn-secondary"
                onClick={() => handleExport('GeoJSON')}
                disabled={exporting}
                title="Export spatial GIS coordinates"
              >
                <Download size={15} />
                <span>Export GeoJSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. DYNAMIC REPORT PREVIEW SECTION ── */}
        <div className="report-preview-section">
          {/* Header Bar with Tabs */}
          <div className="preview-top-bar">
            <div className="preview-heading">
              <div className="preview-seal font-mono">
                PENCH TIGER RESERVE · STATE FOREST DEPT · TIGER INTELLIGENCE
              </div>
              <h2 className="preview-doc-title">
                {activeTemplate.title} — {selectedTiger === 'All Tigers' ? 'Reserve-Wide Census' : selectedTiger}
              </h2>
              <div className="preview-doc-meta font-mono">
                <span>Cycle: {activeTemplate.period} ({dateRange})</span>
                <span>·</span>
                <span>Scope: {selectedZone}</span>
                <span>·</span>
                <span>Authority: Field Directorate</span>
              </div>
            </div>

            <div className="preview-tab-controls">
              <button
                className={`preview-tab-btn ${previewTab === 'web' ? 'preview-tab-btn--active' : ''}`}
                onClick={() => setPreviewTab('web')}
              >
                <Activity size={14} /> Live Interactive Data
              </button>
              <button
                className={`preview-tab-btn ${previewTab === 'print-preview' ? 'preview-tab-btn--active' : ''}`}
                onClick={() => setPreviewTab('print-preview')}
              >
                <Eye size={14} /> Document Print Preview
              </button>
            </div>
          </div>

          {/* Dynamic KPI Stats Cards for Selected Template */}
          <div className="preview-stats-row">
            {activeTemplate.stats.map((st, i) => (
              <div key={i} className="preview-stat-card">
                <div className="preview-stat-k">{st.label}</div>
                <div className={`preview-stat-v font-mono ${st.color === 'accent' ? 'text-accent-gradient' : ''}`}
                     style={st.color === 'danger' ? { color: 'var(--color-danger)' } : st.color === 'success' ? { color: 'var(--color-success)' } : st.color === 'warning' ? { color: 'var(--color-warning)' } : {}}>
                  {st.value}
                </div>
                <div className="preview-stat-sub">{st.sub}</div>
              </div>
            ))}
          </div>

          {/* Content Views */}
          {previewTab === 'web' ? (
            <div className="preview-dynamic-table-container">
              {/* If Template is Reserve Activity or Movement Analysis: Show Tiger Registry */}
              {(selectedTemplate === 'reserve-activity' || selectedTemplate === 'movement-analysis') && (
                <div>
                  <div className="preview-table-title-row">
                    <h4 className="preview-table-title">
                      {selectedTemplate === 'reserve-activity' ? 'Tiger Population Detections & Verified Stripe Register' : 'Spatial Territory, Home Range (KDE 95%) & Centroids'}
                    </h4>
                    <span className="font-mono text-muted text-xs">Showing {filteredTigers.length} individual{filteredTigers.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="preview-table-wrapper">
                    <table className="preview-data-table">
                      <thead>
                        <tr>
                          <th>Tiger ID</th>
                          <th>Sex / Age</th>
                          <th>Zone</th>
                          <th>Captures</th>
                          <th>{selectedTemplate === 'movement-analysis' ? 'KDE 95% Range' : 'Est. Range'}</th>
                          <th>Core Area</th>
                          <th>Last Station</th>
                          <th>Last Recorded</th>
                          <th>Re-ID Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTigers.map(t => (
                          <tr key={t.id}>
                            <td className="font-mono font-bold text-accent">{t.id}</td>
                            <td>{t.sex}, {t.age}</td>
                            <td>
                              <Badge variant={t.zone.includes('Core') ? 'success' : 'warning'}>{t.zone}</Badge>
                            </td>
                            <td className="font-mono">{t.captures}</td>
                            <td className="font-mono">{t.range}</td>
                            <td className="font-mono">{t.core}</td>
                            <td className="text-secondary">{t.station}</td>
                            <td className="text-secondary font-mono text-xs">{t.lastSeen}</td>
                            <td>
                              <span className="conf-pill font-mono">{t.confidence}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* If Template is Perimeter & Alert Digest: Show Alerts Log */}
              {selectedTemplate === 'alert-digest' && (
                <div>
                  <div className="preview-table-title-row">
                    <h4 className="preview-table-title">Perimeter Breach & Conflict Warning Incident Log</h4>
                    <span className="font-mono text-muted text-xs">{MOCK_ALERTS_LOG.length} active logs</span>
                  </div>
                  <div className="preview-table-wrapper">
                    <table className="preview-data-table">
                      <thead>
                        <tr>
                          <th>Alert ID</th>
                          <th>Tiger ID</th>
                          <th>Station Area</th>
                          <th>Incident Type</th>
                          <th>Village Proximity</th>
                          <th>Severity</th>
                          <th>Timestamp</th>
                          <th>Patrol Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_ALERTS_LOG.map(al => (
                          <tr key={al.id}>
                            <td className="font-mono font-bold text-accent">{al.id}</td>
                            <td className="font-mono font-semibold">{al.tigerId}</td>
                            <td>{al.station}</td>
                            <td><Badge variant={al.severity === 'High' ? 'danger' : 'warning'}>{al.type}</Badge></td>
                            <td className="font-mono">{al.distance}</td>
                            <td className="font-mono font-semibold" style={{ color: al.severity === 'High' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{al.severity}</td>
                            <td className="font-mono text-xs text-secondary">{al.date}</td>
                            <td><span className="patrol-badge">{al.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* If Template is Station Health: Show Hardware Status */}
              {selectedTemplate === 'station-health' && (
                <div>
                  <div className="preview-table-title-row">
                    <h4 className="preview-table-title">Camera Trap Sensor & Solar Battery Diagnostic Matrix</h4>
                    <span className="font-mono text-muted text-xs">{MOCK_STATIONS_LOG.length} stations in grid</span>
                  </div>
                  <div className="preview-table-wrapper">
                    <table className="preview-data-table">
                      <thead>
                        <tr>
                          <th>Station ID</th>
                          <th>Location Sector</th>
                          <th>Zone</th>
                          <th>Battery Level</th>
                          <th>Solar Efficiency</th>
                          <th>Frames Captured</th>
                          <th>Operational State</th>
                          <th>Maintenance Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_STATIONS_LOG.map(st => (
                          <tr key={st.id}>
                            <td className="font-mono font-bold text-accent">{st.id}</td>
                            <td>{st.name}</td>
                            <td><Badge variant={st.zone === 'Core' ? 'success' : 'warning'}>{st.zone}</Badge></td>
                            <td className="font-mono font-semibold" style={{ color: parseInt(st.battery) < 25 ? 'var(--color-danger)' : 'var(--color-success)' }}>{st.battery}</td>
                            <td>{st.solar}</td>
                            <td className="font-mono">{st.frames.toLocaleString()}</td>
                            <td>
                              <Badge variant={st.status === 'Operational' ? 'success' : 'danger'}>{st.status}</Badge>
                            </td>
                            <td className="text-secondary text-xs">{st.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* On-screen Print Document Preview */
            <div className="on-screen-print-preview-container">
              <div className="preview-info-strip">
                <Info size={14} />
                <span>This is an exact rendering of the official A4 PDF document that is generated when printing or exporting.</span>
              </div>
              <div className="print-preview-sheet">
                <PrintDocumentContent
                  template={activeTemplate}
                  tigers={filteredTigers}
                  dateRange={dateRange}
                  zone={selectedZone}
                  selectedTiger={selectedTiger}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          OFFICIAL PRINT / PDF DOCUMENT
          This block is styled cleanly with 100% white background, black text,
          official emblems, full tiger registry, individual tiger dossiers,
          and government signatures for pure PDF and printer output.
         ══════════════════════════════════════════════════════════════════ */}
      <div className="official-print-document">
        <PrintDocumentContent
          template={activeTemplate}
          tigers={filteredTigers}
          dateRange={dateRange}
          zone={selectedZone}
          selectedTiger={selectedTiger}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   REUSABLE PRINT / PDF DOCUMENT COMPONENT (ID-BASED)
   ══════════════════════════════════════════════════════════════════ */
function PrintDocumentContent({ template, tigers, dateRange, zone, selectedTiger }) {
  const isSingleTiger = selectedTiger !== 'All Tigers' && tigers.length === 1;
  const singleT = isSingleTiger ? tigers[0] : null;

  return (
    <div className="print-doc-inner">
      {/* ── Official Letterhead & Emblem ── */}
      <div className="print-header">
        <div className="print-gov-seal">
          <div className="seal-emblem">🐅</div>
          <div className="seal-titles">
            <div className="gov-line-1">GOVERNMENT OF MADHYA PRADESH · STATE FOREST DEPARTMENT</div>
            <div className="gov-line-2">PENCH TIGER RESERVE CONSERVATION & MONITORING AUTHORITY</div>
            <div className="gov-line-3">WILDLIFE MOVEMENT & POPULATION INTELLIGENCE WING</div>
          </div>
        </div>

        <div className="print-title-banner">
          <h1 className="print-main-title">
            {isSingleTiger
              ? `OFFICIAL INDIVIDUAL TIGER DOSSIER: ${singleT.id}`
              : `OFFICIAL WILDLIFE REPORT: ${template.title.toUpperCase()}`
            }
          </h1>
          <div className="print-sub-title font-mono">
            MONSOON 2026 MONITORING CYCLE · SURVEILLANCE & RE-ID CENSUS AUDIT
          </div>
        </div>

        <div className="print-metadata-grid">
          <div className="meta-box"><strong>Document Ref:</strong> PTR-WLD-2026-R{Math.floor(Math.random()*800+100)}</div>
          <div className="meta-box"><strong>Generated Date:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div className="meta-box"><strong>Observation Period:</strong> {dateRange}</div>
          <div className="meta-box"><strong>Sector Scope:</strong> {zone}</div>
          <div className="meta-box"><strong>Target Subject:</strong> {selectedTiger}</div>
          <div className="meta-box"><strong>Classification Model:</strong> MegaDetector v5 + Siamese-CNN v1.2</div>
        </div>
      </div>

      {/* ── Executive Statistical Summary ── */}
      <div className="print-summary-box">
        <div className="print-summary-header">EXECUTIVE SUMMARY METRICS</div>
        <div className="print-summary-stats-grid">
          <div className="print-stat-item">
            <span className="print-stat-num">{tigers.length}</span>
            <span className="print-stat-label">Tigers in Scope</span>
          </div>
          <div className="print-stat-item">
            <span className="print-stat-num">
              {tigers.reduce((acc, curr) => acc + curr.captures, 0)}
            </span>
            <span className="print-stat-label">Camera Trap Captures</span>
          </div>
          <div className="print-stat-item">
            <span className="print-stat-num">58 / 64</span>
            <span className="print-stat-label">Active Camera Stations</span>
          </div>
          <div className="print-stat-item">
            <span className="print-stat-num">100%</span>
            <span className="print-stat-label">Stripe Re-ID Audited</span>
          </div>
        </div>
      </div>

      {/* ── Section 1: Full Population Census Registry Table ── */}
      <div className="print-section-block">
        <div className="print-section-heading">
          1. COMPREHENSIVE TIGER POPULATION & SPATIAL TERRITORY REGISTRY
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Tiger ID</th>
              <th>Sex</th>
              <th>Age Est.</th>
              <th>Territory Zone</th>
              <th>Total Captures</th>
              <th>Home Range (95%)</th>
              <th>Core Area (50%)</th>
              <th>Last Station Detected</th>
              <th>Last Recorded Time</th>
              <th>Re-ID Match</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tigers.map(t => (
              <tr key={t.id}>
                <td className="font-mono font-bold">{t.id}</td>
                <td>{t.sex}</td>
                <td>{t.age}</td>
                <td>{t.zone}</td>
                <td className="font-mono font-bold">{t.captures}</td>
                <td className="font-mono">{t.range}</td>
                <td className="font-mono">{t.core}</td>
                <td>{t.station}</td>
                <td className="font-mono">{t.lastSeen}</td>
                <td className="font-mono"><strong>{t.confidence}</strong></td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 2: Detailed Individual Tiger Dossiers (With Flank Images & Capture Logs) ── */}
      <div className="print-section-block" style={{ pageBreakBefore: 'auto' }}>
        <div className="print-section-heading">
          2. INDIVIDUAL TIGER IDENTIFICATION DOSSIERS & STRIPE BIOMETRICS
        </div>
        <p className="print-section-sub">
          Verified visual flank pattern matching, spatial centroids, and camera detection records:
        </p>

        <div className="print-dossiers-list">
          {tigers.map(t => (
            <div key={t.id} className="print-tiger-dossier-card">
              <div className="print-dossier-header">
                <div className="dossier-name-box">
                  <span className="dossier-id font-mono" style={{ fontSize: '15px', fontWeight: 800 }}>{t.id}</span>
                  <span className="dossier-meta-pill">({t.sex} · {t.age} · {t.zone})</span>
                </div>
                <div className="dossier-conf-box font-mono">
                  Re-ID Match: <strong>{t.confidence}</strong> ({t.verified})
                </div>
              </div>

              <div className="print-dossier-body">
                {/* Visual Flank Evidence */}
                <div className="print-flank-visuals">
                  <div className="flank-photo-box">
                    <img src={t.leftFlank || t.image} alt={`${t.id} Left Flank`} className="flank-img" />
                    <span className="flank-caption">Left Flank Stripe Profile</span>
                  </div>
                  <div className="flank-photo-box">
                    <img src={t.rightFlank || t.image} alt={`${t.id} Right Flank`} className="flank-img" />
                    <span className="flank-caption">Right Flank Stripe Profile</span>
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div className="print-dossier-meta-grid">
                  <div className="meta-cell">
                    <span className="meta-k">First Recorded:</span>
                    <span className="meta-v">{t.firstSeen}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="meta-k">Last Station:</span>
                    <span className="meta-v">{t.station}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="meta-k">Home Range (KDE 95%):</span>
                    <span className="meta-v font-mono">{t.range}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="meta-k">Core Area (KDE 50%):</span>
                    <span className="meta-v font-mono">{t.core}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="meta-k">Territorial Centroid:</span>
                    <span className="meta-v font-mono">{t.centroid}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="meta-k">Territory Overlaps:</span>
                    <span className="meta-v">{t.territoryOverlap}</span>
                  </div>
                  <div className="meta-cell full-width">
                    <span className="meta-k">Biological Notes:</span>
                    <span className="meta-v">{t.notes}</span>
                  </div>
                </div>
              </div>

              {/* Recent Camera Station Capture Logs for this Tiger */}
              {t.recentCaptures && t.recentCaptures.length > 0 && (
                <div className="print-tiger-capture-log">
                  <div className="capture-log-title">Recent Automated Camera Detections:</div>
                  <table className="print-sub-table">
                    <thead>
                      <tr>
                        <th>Detection Timestamp</th>
                        <th>Camera Station</th>
                        <th>Sector Zone</th>
                        <th>AI Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.recentCaptures.map((c, ci) => (
                        <tr key={ci}>
                          <td className="font-mono">{c.date}</td>
                          <td>{c.station}</td>
                          <td>{c.zone}</td>
                          <td className="font-mono"><strong>{c.conf}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Official Certification & Signatures ── */}
      <div className="print-signatures-section">
        <div className="print-cert-statement">
          <strong>Official Certification:</strong> I hereby verify and certify that the wildlife movement, camera trap detections,
          and individual tiger stripe re-identification data presented in this intelligence report are accurately catalogued and cross-referenced
          with the Pench Tiger Reserve automated surveillance network and field patrol logs.
        </div>

        <div className="print-signatures-row">
          <div className="print-sign-box">
            <div className="print-sign-line" />
            <div className="print-sign-name">Ranger Amit Sharma</div>
            <div className="print-sign-role">Chief Wildlife Warden</div>
            <div className="print-sign-dept">Pench Tiger Reserve, Seoni / Chhindwara</div>
          </div>
          <div className="print-sign-box">
            <div className="print-sign-line" />
            <div className="print-sign-name">Dr. Priya Desai</div>
            <div className="print-sign-role">Senior Wildlife Biologist & Re-ID Specialist</div>
            <div className="print-sign-dept">Tiger Movement Intelligence Directorate</div>
          </div>
        </div>

        <div className="print-footer-notice font-mono">
          CONFIDENTIAL · FOR OFFICIAL WILDLIFE CONSERVATION USE ONLY · STATE FOREST DEPARTMENT
        </div>
      </div>
    </div>
  );
}
