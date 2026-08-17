import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PawPrint, MapPinned, Bell,
  Cpu, Radio, Settings as SettingsIcon, CircleUser,
  CheckSquare, FileText, Wifi, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const NAV = [
  {
    section: 'WORKSPACE',
    items: [
      { to: '/',           icon: LayoutDashboard, label: 'Overview' },
      { to: '/processing', icon: Cpu,             label: 'Processing Runs' },
      { to: '/review',     icon: CheckSquare,     label: 'Review Queue', badge: 24 },
    ]
  },
  {
    section: 'INSIGHTS',
    items: [
      { to: '/catalogue',  icon: PawPrint,        label: 'Tiger Catalogue' },
      { to: '/map',        icon: MapPinned,       label: 'Movement Map' },
      { to: '/stations',   icon: Radio,           label: 'Camera Stations' },
      { to: '/alerts',     icon: Bell,            label: 'Alerts', badge: 8 },
    ]
  },
  {
    section: 'REPORTING',
    items: [
      { to: '/reports',    icon: FileText,        label: 'Reports' },
    ]
  },
  {
    section: 'SYSTEM',
    items: [
      { to: '/settings',   icon: SettingsIcon,    label: 'Settings' },
    ]
  }
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <PawPrint size={20} />
          </div>
          <div>
            <span className="sidebar-logo-title">TigerWatch</span>
            <span className="sidebar-logo-sub">Pench Tiger Reserve</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section} className="sidebar-group">
              <span className="sidebar-group-label">{group.section}</span>
              {group.items.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
                  }
                  onClick={onClose}
                >
                  <Icon size={18} className="sidebar-item-icon" />
                  <span className="sidebar-item-label">{label}</span>
                  {badge > 0 && (
                    <span className="sidebar-badge">{badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom user with Log Out */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar font-mono">
              {user?.avatar || <CircleUser size={18} />}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || 'Field Officer'}</span>
              <span className="sidebar-user-role">
                <Wifi size={10} style={{ color: 'var(--color-success)' }} />
                {user?.role || 'Authorized Ranger'}
              </span>
            </div>
            <button
              className="sidebar-logout-btn"
              title="Sign Out / Lock Session"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
