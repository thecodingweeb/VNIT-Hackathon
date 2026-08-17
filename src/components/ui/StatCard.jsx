import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from './Card';
import './StatCard.css';

export default function StatCard({ label, value, unit, trend, trendLabel, icon: Icon, color, style }) {
  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  return (
    <Card className="stat-card" style={style}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div className="stat-card-icon" style={{ color: color || 'var(--accent)' }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="stat-card-value">
        <span className="stat-value font-mono">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className={`stat-card-trend stat-card-trend--${trendDir}`}>
          {trendDir === 'up'   && <TrendingUp  size={14} />}
          {trendDir === 'down' && <TrendingDown size={14} />}
          {trendDir === 'flat' && <Minus        size={14} />}
          <span className="stat-trend-text">
            {trend !== undefined && `${trend > 0 ? '+' : ''}${trend}`}
            {trendLabel && ` ${trendLabel}`}
          </span>
        </div>
      )}
    </Card>
  );
}
