import React from 'react';
import './Button.css';

/**
 * variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
 * size:    'sm' | 'md' | 'lg'
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight,
  loading,
  disabled,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${loading ? 'btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {Icon && !loading && <Icon size={size === 'sm' ? 14 : 16} className="btn-icon-left" />}
      {children && <span className="btn-label">{children}</span>}
      {iconRight && !loading && <iconRight size={16} className="btn-icon-right" />}
    </button>
  );
}
