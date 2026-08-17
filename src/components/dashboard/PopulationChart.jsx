import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import './PopulationChart.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="pop-chart-tooltip">
      <span className="pop-chart-tooltip-label">{label}</span>
      <span className="pop-chart-tooltip-value">{payload[0].value} tigers</span>
    </div>
  );
};

export default function PopulationChart({ data = [] }) {
  return (
    <div className="pop-chart-container">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="tigerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#B8822E" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#B8822E" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(184,130,46,0.2)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#B8822E"
            strokeWidth={2}
            fill="url(#tigerGrad)"
            dot={{ fill: '#B8822E', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#D4993A', r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
