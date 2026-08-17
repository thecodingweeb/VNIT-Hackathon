import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalogue from './pages/Catalogue';
import OccupancyMap from './pages/OccupancyMap';
import Alerts from './pages/Alerts';
import Processing from './pages/Processing';
import Stations from './pages/Stations';
import Settings from './pages/Settings';
import ReviewQueue from './pages/ReviewQueue';
import Reports from './pages/Reports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/"           element={<Dashboard />}   />
            <Route path="/processing" element={<Processing />}  />
            <Route path="/review"     element={<ReviewQueue />} />
            <Route path="/catalogue"  element={<Catalogue />}   />
            <Route path="/map"        element={<OccupancyMap />}/>
            <Route path="/stations"   element={<Stations />}    />
            <Route path="/alerts"     element={<Alerts />}      />
            <Route path="/reports"    element={<Reports />}     />
            <Route path="/settings"   element={<Settings />}    />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
