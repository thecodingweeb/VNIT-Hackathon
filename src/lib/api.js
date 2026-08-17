/**
 * Central API Client for connecting React Frontend with FastAPI Backend & Supabase
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchJSON(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Network response was not ok' }));
      throw new Error(err.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[API] Failed to fetch ${endpoint}, using fallback state:`, error.message);
    throw error;
  }
}

export const api = {
  // --- Dashboard ---
  getDashboardStats: () => fetchJSON('/dashboard/stats'),
  getActivityFeed: () => fetchJSON('/dashboard/activity'),

  // --- Tigers / Catalogue ---
  getTigers: (params = '') => fetchJSON(`/identification/tigers${params ? `?${params}` : ''}`),
  getTigerById: (id) => fetchJSON(`/identification/tigers/${id}`),
  enrollTiger: (data) => fetchJSON('/identification/enroll', { method: 'POST', body: JSON.stringify(data) }),

  // --- Stations ---
  getStations: () => fetchJSON('/stations'),
  getStationHealth: (id) => fetchJSON(`/stations/${id}/health`),

  // --- Alerts ---
  getAlerts: () => fetchJSON('/alerts'),
  acknowledgeAlert: (id) => fetchJSON(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolveAlert: (id, notes) => fetchJSON(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }),

  // --- Processing Runs ---
  getRuns: () => fetchJSON('/runs'),
  triggerRun: (runData) => fetchJSON('/runs/trigger', { method: 'POST', body: JSON.stringify(runData) }),

  // --- Occupancy & Territories ---
  getOccupancyKDE: () => fetchJSON('/occupancy/kde'),
  getCentroids: () => fetchJSON('/occupancy/centroids'),
};

export default api;
