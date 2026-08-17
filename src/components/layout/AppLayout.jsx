import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AmbientBackground from './AmbientBackground';
import './AppLayout.css';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <AmbientBackground />
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <TopBar
          mobileOpen={mobileOpen}
          onMenuToggle={() => setMobileOpen(v => !v)}
        />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
