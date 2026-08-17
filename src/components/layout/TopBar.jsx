import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Search, Menu, X, Cpu, PawPrint,
  MapPin, Radio, AlertTriangle, ArrowRight, Check
} from 'lucide-react';
import './TopBar.css';

const BREADCRUMBS = {
  '/':           ['Dashboard', 'Overview'],
  '/processing': ['Workspace', 'Processing Runs'],
  '/review':     ['Workspace', 'Review Queue'],
  '/catalogue':  ['Insights', 'Tiger Catalogue'],
  '/map':        ['Insights', 'Movement Map'],
  '/stations':   ['Insights', 'Camera Stations'],
  '/alerts':     ['Insights', 'Alerts Centre'],
  '/reports':    ['Reporting', 'Reports & Exports'],
  '/settings':   ['System', 'Settings'],
};

const SEARCH_ITEMS = [
  { type: 'tiger',   title: 'PTR-T-001', sub: 'Male · Core Zone · 148 captures', link: '/catalogue' },
  { type: 'tiger',   title: 'PTR-T-007', sub: 'Male · Core Zone · 96 captures', link: '/catalogue' },
  { type: 'tiger',   title: 'PTR-T-014', sub: 'Female · Core Zone · 106 captures', link: '/catalogue' },
  { type: 'tiger',   title: 'PTR-T-021', sub: 'Female · Buffer Zone · 41 captures', link: '/catalogue' },
  { type: 'station', title: 'Station ST-42 (Kohka Ridge)', sub: 'Core Zone · Battery 92% · Online', link: '/stations' },
  { type: 'station', title: 'Station ST-18 (Turia Gate)', sub: 'Buffer Zone · Battery 78% · Online', link: '/stations' },
  { type: 'alert',   title: 'Buffer Approach Alert (PTR-T-001)', sub: 'Station ST-42 · High Priority', link: '/alerts' },
  { type: 'run',     title: 'Processing Run #2026-08-17-004', sub: 'In Progress · 57.5% complete', link: '/processing' },
];

const NOTIFICATIONS = [
  { id: 1, title: 'Buffer Zone Approach', desc: 'PTR-T-001 detected 4.8km from village perimeter', time: '18 min ago', link: '/alerts', unread: true },
  { id: 2, title: 'Processing Batch Complete', desc: 'Run #048 classified 1,842 frames in Turia sector', time: '1 hr ago', link: '/processing', unread: true },
  { id: 3, title: 'Camera Battery Alert', desc: 'Station ST-49 Teak Slope dropped below 25%', time: '3 hr ago', link: '/stations', unread: false },
];

export default function TopBar({ onMenuToggle, mobileOpen, processing }) {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = BREADCRUMBS[location.pathname] || ['Page'];

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  // Global Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSearch = SEARCH_ITEMS.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sub.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSearch = (link) => {
    setShowSearch(false);
    navigate(link);
  };

  const handleNotificationClick = (item) => {
    setNotifications(notifications.map(n => n.id === item.id ? { ...n, unread: false } : n));
    setShowNotifications(false);
    navigate(item.link);
  };

  return (
    <header className="topbar">
      {/* Left */}
      <div className="topbar-left">
        <button
          className="topbar-menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className="topbar-breadcrumb" aria-label="breadcrumb">
          <span className="topbar-crumb topbar-crumb--root">TigerWatch</span>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb}>
              <span className="topbar-crumb-sep">/</span>
              <span className={`topbar-crumb ${i === crumbs.length - 1 ? 'topbar-crumb--active' : ''}`}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right */}
      <div className="topbar-right">
        {processing && (
          <div className="topbar-processing" onClick={() => navigate('/processing')} style={{ cursor: 'pointer' }}>
            <Cpu size={14} className="topbar-processing-icon" />
            <span>Run active</span>
          </div>
        )}
        <button
          className="topbar-icon-btn"
          aria-label="Search (Ctrl+K)"
          onClick={() => setShowSearch(true)}
        >
          <Search size={18} />
          <span className="topbar-shortcut">Ctrl K</span>
        </button>
        <button
          className="topbar-icon-btn topbar-bell"
          aria-label="Notifications"
          onClick={() => setShowNotifications(prev => !prev)}
        >
          <Bell size={18} />
          {notifications.filter(n => n.unread).length > 0 && (
            <span className="topbar-bell-badge">
              {notifications.filter(n => n.unread).length}
            </span>
          )}
        </button>
      </div>

      {/* Processing indicator bar */}
      {processing && <div className="topbar-progress-bar" />}

      {/* ── Spotlight Search Modal (Ctrl+K) ── */}
      {showSearch && (
        <div className="cat-modal-backdrop" onClick={() => setShowSearch(false)}>
          <div className="topbar-search-modal" onClick={e => e.stopPropagation()}>
            <div className="topbar-search-input-wrap">
              <Search size={18} className="topbar-search-icon" />
              <input
                type="text"
                autoFocus
                placeholder="Search tigers, camera stations, alerts, or processing runs…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="topbar-search-input font-sans"
              />
              <button className="cat-modal-close" onClick={() => setShowSearch(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="topbar-search-results">
              {filteredSearch.length === 0 ? (
                <div className="topbar-search-empty font-mono">No matching records found</div>
              ) : (
                filteredSearch.map((item, idx) => (
                  <div
                    key={idx}
                    className="topbar-search-item"
                    onClick={() => handleSelectSearch(item.link)}
                  >
                    <div className="topbar-search-item-icon">
                      {item.type === 'tiger' && <PawPrint size={15} color="var(--accent)" />}
                      {item.type === 'station' && <Radio size={15} color="var(--color-success)" />}
                      {item.type === 'alert' && <AlertTriangle size={15} color="var(--color-danger)" />}
                      {item.type === 'run' && <Cpu size={15} color="var(--color-info)" />}
                    </div>
                    <div className="topbar-search-item-info">
                      <div className="topbar-search-item-title">{item.title}</div>
                      <div className="topbar-search-item-sub">{item.sub}</div>
                    </div>
                    <ArrowRight size={14} className="topbar-search-item-arrow" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications Dropdown ── */}
      {showNotifications && (
        <div className="topbar-notif-dropdown">
          <div className="topbar-notif-header">
            <span className="topbar-notif-title">Alerts & System Events</span>
            <button
              className="topbar-notif-clear font-mono"
              onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
            >
              Mark all read
            </button>
          </div>
          <div className="topbar-notif-list">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`topbar-notif-item ${n.unread ? 'topbar-notif-item--unread' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="topbar-notif-item-top">
                  <span className="topbar-notif-item-title">{n.title}</span>
                  <span className="topbar-notif-item-time font-mono">{n.time}</span>
                </div>
                <div className="topbar-notif-item-desc">{n.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
