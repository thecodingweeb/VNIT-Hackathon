import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, PawPrint, Bell, Radio, TrendingUp, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboardStats } from '../hooks/useDashboardStats';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import PopulationChart from '../components/dashboard/PopulationChart';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import MiniMap from '../components/dashboard/MiniMap';
import AlertSummaryChart from '../components/dashboard/AlertSummaryChart';
import ProcessingRunsTable from '../components/dashboard/ProcessingRunsTable';
import './Dashboard.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading } = useDashboardStats();

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner" />
        <span>Loading TigerWatch data…</span>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* ── Welcome Header ── */}
      <motion.div className="dashboard-header" {...fadeUp(0)}>
        <div className="dashboard-header-text">
          <h1 className="dashboard-title">
            Good evening, <span className="text-accent-gradient">Field Officer</span>
          </h1>
          <p className="dashboard-subtitle">
            Last processing run <span className="font-mono" style={{ color: 'var(--accent)' }}>#048</span> completed 1 hour ago
            &nbsp;·&nbsp; Pench Tiger Reserve
          </p>
        </div>
        <Button icon={Cpu} id="start-run-btn" onClick={() => navigate('/processing')}>
          Start New Run
        </Button>
      </motion.div>

      {/* ── Stat Cards Row ── */}
      <motion.div className="dashboard-stats" {...fadeUp(0.08)}>
        <StatCard
          label="Total Tigers"
          value={data.totalTigers}
          trend={data.tigerTrend}
          trendLabel="vs last month"
          icon={PawPrint}
          color="var(--accent)"
        />
        <StatCard
          label="Images Processed"
          value={data.imagesProcessed.toLocaleString()}
          trend={data.imagesTrend}
          trendLabel="% this month"
          icon={TrendingUp}
          color="var(--color-info)"
        />
        <StatCard
          label="Active Alerts"
          value={data.activeAlerts}
          trend={data.alertsTrend}
          trendLabel="vs last week"
          icon={Bell}
          color={data.activeAlerts > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
        />
        <StatCard
          label="Stations Online"
          value={`${data.stationsOnline}/${data.stationsTotal}`}
          trendLabel={`${Math.round((data.stationsOnline / data.stationsTotal) * 100)}% operational`}
          icon={Radio}
          color="var(--color-success)"
        />
      </motion.div>

      {/* ── Charts Row ── */}
      <motion.div className="dashboard-charts" {...fadeUp(0.16)}>
        {/* Population Trend */}
        <Card className="dashboard-chart-card dashboard-chart-card--large">
          <div className="card-header">
            <div>
              <h2 className="card-title">Population Trend</h2>
              <p className="card-subtitle">12-month individual count history</p>
            </div>
            <Badge variant="active" dot>Live data</Badge>
          </div>
          <PopulationChart data={data.populationHistory} />
        </Card>

        {/* Activity Feed */}
        <Card className="dashboard-chart-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Activity</h2>
              <p className="card-subtitle">Latest system events</p>
            </div>
          </div>
          <ActivityFeed items={data.recentActivity} />
        </Card>
      </motion.div>

      {/* ── Map + Alert Summary Row ── */}
      <motion.div className="dashboard-map-row" {...fadeUp(0.24)}>
        {/* Mini Map */}
        <Card className="dashboard-map-card" hover={false}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Reserve Map</h2>
              <p className="card-subtitle">Tiger centroid positions — Pench TR</p>
            </div>
            <div className="map-legend">
              {data.tigerCentroids?.slice(0, 4).map(t => (
                <span key={t.id} className="map-legend-dot" style={{ background: t.color }} title={t.name} />
              ))}
              {data.tigerCentroids?.length > 4 && (
                <span className="map-legend-more">+{data.tigerCentroids.length - 4}</span>
              )}
            </div>
          </div>
          <MiniMap centroids={data.tigerCentroids} />
        </Card>

        {/* Alert Summary */}
        <Card className="dashboard-alert-summary-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Alerts by Type</h2>
              <p className="card-subtitle">Current active alerts breakdown</p>
            </div>
          </div>
          <AlertSummaryChart data={data.alertSummary} />

          <div className="alert-type-legend">
            {data.alertSummary.map(a => (
              <div key={a.type} className="alert-legend-item">
                <span className="alert-legend-dot" style={{ background: a.color }} />
                <span className="alert-legend-label">{a.type.replace('_', ' ')}</span>
                <span className="alert-legend-count font-mono">{a.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ── Processing Runs Table ── */}
      <motion.div {...fadeUp(0.32)}>
        <Card>
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Processing Runs</h2>
              <p className="card-subtitle">Last 5 pipeline executions</p>
            </div>
            <Button variant="secondary" size="sm" id="view-all-runs-btn" onClick={() => navigate('/processing')}>
              View All
            </Button>
          </div>
          <ProcessingRunsTable runs={data.processingRuns} />
        </Card>
      </motion.div>

    </div>
  );
}
