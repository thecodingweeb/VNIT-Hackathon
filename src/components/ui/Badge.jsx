import React from 'react';
import './Badge.css';

/**
 * variant: 'active' | 'absent' | 'provisional' | 'high' | 'medium' | 'low'
 *          | 'info' | 'danger' | 'warning' | 'success'
 */
export default function Badge({ variant = 'info', children, dot = false }) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
