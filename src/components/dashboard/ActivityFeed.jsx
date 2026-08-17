import React from 'react';
import { UserPlus, Bell, Cpu, MapPin, Eye } from 'lucide-react';
import './ActivityFeed.css';

const ICONS = {
  enrollment: { icon: UserPlus, color: 'var(--color-success)' },
  alert:      { icon: Bell,     color: 'var(--color-danger)'  },
  run:        { icon: Cpu,      color: 'var(--color-info)'    },
  location:   { icon: MapPin,   color: 'var(--accent)'        },
  review:     { icon: Eye,      color: 'var(--color-warning)' },
};

export default function ActivityFeed({ items = [] }) {
  return (
    <div className="activity-feed">
      {items.map((item, idx) => {
        const config = ICONS[item.type] || ICONS.review;
        const Icon = config.icon;
        return (
          <div key={item.id} className="activity-item" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="activity-icon" style={{ color: config.color, background: `${config.color}18`, borderColor: `${config.color}30` }}>
              <Icon size={14} />
            </div>
            <div className="activity-content">
              <p className="activity-text">{item.text}</p>
              <span className="activity-time">{item.time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
