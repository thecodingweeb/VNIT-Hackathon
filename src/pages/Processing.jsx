import React, { useState, useEffect } from 'react';
import {
  Cpu, Play, Pause, RotateCcw, CheckCircle, Clock, AlertTriangle,
  ChevronDown, BarChart2, Image, ScanLine,
  Layers, Bell, FileText, RefreshCw, Download, Sparkles, Terminal, Activity
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import './Processing.css';

const PIPELINE_STAGES = [
  { key: 'ingest',   label: 'Ingestion',        icon: Image,    desc: 'Loading raw camera trap images from SD cards & 4G nodes' },
  { key: 'filter',   label: 'Blank Filtering',   icon: ScanLine, desc: 'Filtering empty frames & vegetation sway via MegaDetector v5' },
  { key: 'detect',   label: 'Tiger Detection',   icon: Cpu,      desc: 'Running species bounding-box classifier (YOLOv8 + ResNet)' },
  { key: 'match',    label: 'Identity Match',    icon: Layers,   desc: 'Extracting stripe embeddings & Siamese-CNN flank matching' },
  { key: 'analyze',  label: 'Analytics Engine',  icon: BarChart2,desc: 'Updating KDE home range & spatial movement centroids' },
  { key: 'alert',    label: 'Alert Generation',  icon: Bell,     desc: 'Evaluating buffer approach & novel territory alert rules' },
];

const INITIAL_RUN_STATE = {
  id: '#2026-08-17-004',
  started: '17 Aug 2026, 14:30',
  totalImages: 3200,
  processedImages: 1842,
  throughput: 38,
  gpu: 76,
  isPaused: false,
  isCompleted: false,
  currentStageKey: 'detect',
  log: [
    { time: '14:32:18', msg: 'Tiger detection model v2.1 active on GPU cluster (CUDA Core 0-3)' },
    { time: '14:32:16', msg: 'Processing batch 26 (images 1537–1600) — 14 tiger candidates identified' },
    { time: '14:31:59', msg: 'Blank filtering complete — 1,358 empty/wind-trigger frames removed' },
    { time: '14:30:44', msg: 'MegaDetector v5 background scan completed in 32.4s' },
    { time: '14:30:12', msg: 'Image ingestion complete — 3,200 images loaded from 14 camera stations' },
    { time: '14:30:00', msg: 'Run #2026-08-17-004 initiated by Field Officer (Kohka Sector Grid)' },
  ]
};

const PAST_RUNS = [
  { id: '#048', status: 'completed', date: '15 Aug 2026', duration: '42 min', images: 9817,  tigers: 742,  newTigers: 0, alerts: 1 },
  { id: '#047', status: 'completed', date: '13 Aug 2026', duration: '58 min', images: 14502, tigers: 1103, newTigers: 2, alerts: 2 },
  { id: '#046', status: 'failed',    date: '11 Aug 2026', duration: '12 min', images: 3201,  tigers: 0,    newTigers: 0, alerts: 0 },
  { id: '#045', status: 'completed', date: '09 Aug 2026', duration: '51 min', images: 12890, tigers: 988,  newTigers: 1, alerts: 4 },
  { id: '#044', status: 'completed', date: '07 Aug 2026', duration: '37 min', images: 8450,  tigers: 681,  newTigers: 0, alerts: 0 },
];

export default function Processing() {
  const [run, setRun] = useState(INITIAL_RUN_STATE);
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);

  // Live simulation timer that moves the pipeline forward
  useEffect(() => {
    if (!isLiveSimulating || run.isPaused || run.isCompleted) return;

    const interval = setInterval(() => {
      setRun(prev => {
        if (prev.processedImages >= prev.totalImages) {
          // Transition to next stage or complete
          if (prev.currentStageKey === 'detect') {
            return {
              ...prev,
              currentStageKey: 'match',
              processedImages: 2400,
              log: [
                { time: new Date().toTimeString().slice(0, 8), msg: 'Tiger detection complete! Initiating Siamese-CNN Stripe Re-ID…' },
                ...prev.log
              ]
            };
          } else if (prev.currentStageKey === 'match') {
            return {
              ...prev,
              currentStageKey: 'analyze',
              processedImages: 2900,
              log: [
                { time: new Date().toTimeString().slice(0, 8), msg: 'Flank Re-ID matched PTR-T-001 (97.2%) and PTR-T-007 (91.2%). Calculating spatial shifts…' },
                ...prev.log
              ]
            };
          } else if (prev.currentStageKey === 'analyze') {
            return {
              ...prev,
              currentStageKey: 'alert',
              processedImages: 3150,
              log: [
                { time: new Date().toTimeString().slice(0, 8), msg: 'KDE range calculations complete. Verifying perimeter safety buffer boundaries…' },
                ...prev.log
              ]
            };
          } else if (prev.currentStageKey === 'alert') {
            return {
              ...prev,
              isCompleted: true,
              processedImages: prev.totalImages,
              gpu: 12,
              log: [
                { time: new Date().toTimeString().slice(0, 8), msg: '✓ Run #2026-08-17-004 completed successfully! 3 Buffer alerts generated and routed to Review Queue.' },
                ...prev.log
              ]
            };
          }
          return { ...prev, isCompleted: true };
        }

        // Progress currently running stage
        const step = Math.floor(Math.random() * 25 + 15);
        const nextProcessed = Math.min(prev.totalImages, prev.processedImages + step);
        const gpuFluct = Math.floor(Math.random() * 12 + 70);

        const newLogs = [...prev.log];
        if (nextProcessed % 200 < 35) {
          newLogs.unshift({
            time: new Date().toTimeString().slice(0, 8),
            msg: `Batch processing: frame ${nextProcessed} / ${prev.totalImages} verified by AI pipeline`
          });
        }

        return {
          ...prev,
          processedImages: nextProcessed,
          gpu: gpuFluct,
          log: newLogs.slice(0, 15)
        };
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isLiveSimulating, run.isPaused, run.isCompleted, run.currentStageKey]);

  const overallPct = Math.min(100, Math.round((run.processedImages / run.totalImages) * 100));

  // Determine stage status dynamically
  const getStageStatus = (key) => {
    if (run.isCompleted) return 'completed';
    const order = ['ingest', 'filter', 'detect', 'match', 'analyze', 'alert'];
    const currentIdx = order.indexOf(run.currentStageKey);
    const thisIdx = order.indexOf(key);

    if (thisIdx < currentIdx) return 'completed';
    if (thisIdx === currentIdx) return run.isPaused ? 'paused' : 'running';
    return 'queued';
  };

  const getStageCount = (key) => {
    const status = getStageStatus(key);
    if (status === 'completed') return run.totalImages;
    if (status === 'running' || status === 'paused') return run.processedImages;
    return 0;
  };

  const handleRestart = () => {
    setRun({
      ...INITIAL_RUN_STATE,
      processedImages: 100,
      currentStageKey: 'detect',
      isCompleted: false,
      isPaused: false,
      log: [
        { time: new Date().toTimeString().slice(0, 8), msg: 'Resetting AI Pipeline simulation for Run #2026-08-17-004' },
        ...INITIAL_RUN_STATE.log
      ]
    });
  };

  return (
    <div className="processing-page">
      {/* ── Page Explanation Header ── */}
      <div className="proc-header">
        <div>
          <h1 className="proc-title">AI Processing Pipeline Runs</h1>
          <p className="proc-subtitle">
            Automated batch ingestion and neural network classification pipeline for camera trap imagery across Pench TR.
          </p>
        </div>

        <div className="proc-controls-group">
          <button
            className={`cat-btn-secondary ${run.isPaused ? 'btn-resume' : ''}`}
            onClick={() => setRun(prev => ({ ...prev, isPaused: !prev.isPaused }))}
            disabled={run.isCompleted}
          >
            {run.isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span>{run.isPaused ? 'Resume Processing' : 'Pause Pipeline'}</span>
          </button>
          <button
            className="cat-btn-secondary"
            onClick={handleRestart}
            title="Restart the pipeline simulation from start"
          >
            <RotateCcw size={14} />
            <span>Restart Run</span>
          </button>
        </div>
      </div>

      {/* ── Pipeline Architecture Explanation Banner ── */}
      <div className="proc-explainer-banner">
        <div className="explainer-icon"><Sparkles size={20} /></div>
        <div className="explainer-content">
          <div className="explainer-title">How the TigerWatch AI Pipeline Works</div>
          <div className="explainer-desc">
            When camera trap SD cards or 4G cellular nodes upload batches of images, they pass through a 6-stage AI workflow:
            <strong> Blank Removal</strong> (MegaDetector) → <strong>Species Detection</strong> (YOLO) → <strong>Stripe Re-ID</strong> (Siamese-CNN) → <strong>Movement Range Engine</strong> → <strong>Buffer Alert Generation</strong>.
          </div>
        </div>
      </div>

      {/* ── Active Run Card ── */}
      <div className="proc-section-title">Active Batch Ingestion & Inference</div>
      <div className="proc-active-card">
        <div className="proc-active-header">
          <div>
            <span className="proc-run-id font-mono">Run {run.id}</span>
            <span className="proc-run-status">
              <span className={`proc-run-dot ${run.isCompleted ? 'proc-run-dot--done' : run.isPaused ? 'proc-run-dot--paused' : ''}`} />
              {run.isCompleted ? 'Pipeline Completed' : run.isPaused ? 'Pipeline Paused' : `Processing: ${PIPELINE_STAGES.find(s => s.key === run.currentStageKey)?.label}`}
            </span>
          </div>
          <div className="proc-active-meta">
            <span className="proc-meta-item"><Clock size={13}/>Started {run.started}</span>
            <span className="proc-meta-item"><BarChart2 size={13}/>{run.throughput} img/sec</span>
            <span className="proc-meta-item" style={{ color: run.isCompleted ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {run.isCompleted ? '✓ Completed' : `ETA: ~${Math.max(1, Math.round((run.totalImages - run.processedImages) / (run.throughput * 60)))} min remaining`}
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="proc-overall-progress">
          <div className="proc-overall-bar-bg">
            <div
              className={`proc-overall-bar-fill ${run.isCompleted ? 'proc-overall-bar-fill--done' : ''}`}
              style={{ width: `${overallPct}%` }}
            >
              {!run.isCompleted && !run.isPaused && <div className="proc-bar-shimmer"/>}
            </div>
          </div>
          <div className="proc-overall-nums">
            <span className="font-mono" style={{ color: run.isCompleted ? 'var(--color-success)' : 'var(--accent)' }}>
              {run.processedImages.toLocaleString()} / {run.totalImages.toLocaleString()} images analyzed
            </span>
            <span className="font-mono" style={{ color: run.isCompleted ? 'var(--color-success)' : 'var(--accent-bright)', fontWeight: 700 }}>
              {overallPct}%
            </span>
          </div>
        </div>

        {/* GPU Hardware Utilization */}
        <div className="proc-gpu-row">
          <span className="proc-gpu-label">NVIDIA RTX AI Cluster Load</span>
          <div className="proc-gpu-bar-bg">
            <div className="proc-gpu-bar-fill" style={{ width: `${run.gpu}%` }}/>
          </div>
          <span className="proc-gpu-pct font-mono">{run.gpu}%</span>
        </div>

        {/* 6-Stage Visual Pipeline */}
        <div className="proc-stages">
          {PIPELINE_STAGES.map(stage => {
            const status = getStageStatus(stage.key);
            const count = getStageCount(stage.key);
            const pct = Math.round((count / run.totalImages) * 100);
            const Icon = stage.icon;

            return (
              <div key={stage.key} className={`stage-item stage-item--${status}`}>
                <div className="stage-icon-wrap">
                  <Icon size={16} />
                  {status === 'running' && <span className="stage-spin-ring" />}
                </div>
                <div className="stage-body">
                  <div className="stage-header-row">
                    <span className="stage-label">{stage.label}</span>
                    <span className="stage-desc">{stage.desc}</span>
                    <span className="stage-status-badge">
                      {status === 'completed' && <CheckCircle size={12} color="var(--color-success)"/>}
                      {status === 'running'   && <span className="stage-running-dot"/>}
                      {status === 'paused'    && <Pause size={12} color="var(--color-warning)"/>}
                      {status === 'queued'    && <Clock size={12} color="var(--fg-muted)"/>}
                      <span className={`stage-status-text stage-status-text--${status}`}>
                        {status}
                      </span>
                    </span>
                  </div>
                  <div className="stage-progress-bar">
                    <div
                      className="stage-progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: status === 'completed' ? 'var(--color-success)' : status === 'paused' ? 'var(--color-warning)' : 'var(--accent)'
                      }}
                    />
                  </div>
                  <div className="stage-count font-mono">
                    {count.toLocaleString()} / {run.totalImages.toLocaleString()} images ({pct}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Terminal Processing Log */}
        <div className="proc-log">
          <div className="proc-log-header">
            <div className="proc-log-title-wrap">
              <Terminal size={14} className="text-accent" />
              <span className="proc-log-title">Live Execution Logs</span>
            </div>
            <span className="font-mono text-muted text-xs">Real-time inference stream</span>
          </div>
          <div className="proc-log-terminal">
            {run.log.map((entry, i) => (
              <div key={i} className="proc-log-line">
                <span className="proc-log-time font-mono">[{entry.time}]</span>
                <span className="proc-log-msg">{entry.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Historical Ingestion Runs ── */}
      <div className="proc-section-title" style={{ marginTop: 'var(--space-2xl)' }}>Historical Batch Runs</div>
      <div className="proc-history-table-wrap">
        <table className="proc-history-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Status</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Images</th>
              <th>Tiger Detections</th>
              <th>New Enrollments</th>
              <th>Alerts Generated</th>
              <th>Export</th>
            </tr>
          </thead>
          <tbody>
            {PAST_RUNS.map(r => (
              <tr key={r.id} className="proc-history-row">
                <td><span className="font-mono" style={{ color: 'var(--accent)' }}>{r.id}</span></td>
                <td><Badge variant={r.status}>{r.status}</Badge></td>
                <td><span style={{ color: 'var(--fg-secondary)', fontSize: '13px' }}>{r.date}</span></td>
                <td><span className="font-mono" style={{ fontSize: '13px' }}>{r.duration}</span></td>
                <td><span className="font-mono" style={{ fontSize: '13px' }}>{r.images.toLocaleString()}</span></td>
                <td><span className="font-mono" style={{ fontSize: '13px' }}>{r.tigers.toLocaleString()}</span></td>
                <td><span className="font-mono" style={{ fontSize: '13px', color: r.newTigers > 0 ? 'var(--accent-bright)' : 'var(--fg-muted)' }}>{r.newTigers}</span></td>
                <td><span className="font-mono" style={{ fontSize: '13px', color: r.alerts > 0 ? 'var(--color-warning)' : 'var(--fg-muted)' }}>{r.alerts}</span></td>
                <td>
                  {r.status === 'completed' && (
                    <button className="stn-action-icon" title="Download Run Audit Log"><Download size={13}/></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
