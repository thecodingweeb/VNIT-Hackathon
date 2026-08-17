import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/* ─── Mock data used when Supabase is not yet connected ─── */
const MOCK = {
  totalTigers: 24,
  tigerTrend: +3,
  imagesProcessed: 118420,
  imagesTrend: +12.4,
  activeAlerts: 5,
  alertsTrend: -2,
  stationsOnline: 41,
  stationsTotal: 48,
  populationHistory: [
    { month: 'Jan', count: 19 }, { month: 'Feb', count: 20 },
    { month: 'Mar', count: 20 }, { month: 'Apr', count: 21 },
    { month: 'May', count: 22 }, { month: 'Jun', count: 21 },
    { month: 'Jul', count: 23 }, { month: 'Aug', count: 22 },
    { month: 'Sep', count: 23 }, { month: 'Oct', count: 24 },
    { month: 'Nov', count: 24 }, { month: 'Dec', count: 24 },
  ],
  recentActivity: [
    { id: 1, type: 'enrollment', text: 'New individual enrolled: PTR-T-025', time: '2 min ago' },
    { id: 2, type: 'alert',      text: 'BUFFER_APPROACH alert: PTR-T-012 near village zone', time: '18 min ago' },
    { id: 3, type: 'run',        text: 'Processing run #48 completed — 11,204 images', time: '1 hr ago' },
    { id: 4, type: 'enrollment', text: 'New individual enrolled: PTR-T-024', time: '3 hr ago' },
    { id: 5, type: 'alert',      text: 'RANGE_SHIFT alert: PTR-T-007 new station first detected', time: '5 hr ago' },
  ],
  alertSummary: [
    { type: 'RANGE_SHIFT',       count: 2, color: '#3B82F6' },
    { type: 'NOVEL_STATION',     count: 1, color: '#10B981' },
    { type: 'BUFFER_APPROACH',   count: 1, color: '#EF4444' },
    { type: 'PROLONGED_ABSENCE', count: 1, color: '#9CA3AF' },
  ],
  processingRuns: [
    { id: '#048', status: 'completed', date: '17 Aug 2026', images: '11,204', detections: 890,  newEnrollments: 1, alerts: 3 },
    { id: '#047', status: 'completed', date: '15 Aug 2026', images: '9,817',  detections: 742,  newEnrollments: 0, alerts: 1 },
    { id: '#046', status: 'completed', date: '13 Aug 2026', images: '14,502', detections: 1103, newEnrollments: 2, alerts: 2 },
    { id: '#045', status: 'failed',    date: '11 Aug 2026', images: '3,201',  detections: 0,    newEnrollments: 0, alerts: 0 },
    { id: '#044', status: 'completed', date: '09 Aug 2026', images: '12,890', detections: 988,  newEnrollments: 1, alerts: 4 },
  ],
  tigerCentroids: [
    { id: 'PTR-T-001', lat: 21.73, lng: 79.31, color: '#FF8C30' },
    { id: 'PTR-T-002', lat: 21.76, lng: 79.38, color: '#3860FF' },
    { id: 'PTR-T-003', lat: 21.70, lng: 79.42, color: '#10B981' },
    { id: 'PTR-T-004', lat: 21.79, lng: 79.27, color: '#F04444' },
    { id: 'PTR-T-005', lat: 21.68, lng: 79.35, color: '#8B5CF6' },
    { id: 'PTR-T-007', lat: 21.74, lng: 79.44, color: '#41B8AC' },
    { id: 'PTR-T-012', lat: 21.81, lng: 79.33, color: '#F97316' },
  ],
};

export function useDashboardStats() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function fetchStats() {
      /* If Supabase is not configured, use mock data */
      if (!supabase) {
        await new Promise(r => setTimeout(r, 600)); // simulate network
        setData(MOCK);
        setLoading(false);
        return;
      }

      try {
        const [tigers, alerts, runs] = await Promise.all([
          supabase.from('individuals').select('id', { count: 'exact', head: true }),
          supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'new'),
          supabase.from('processing_runs').select('*').order('created_at', { ascending: false }).limit(5),
        ]);
        setData({
          ...MOCK,
          totalTigers:  tigers.count  ?? MOCK.totalTigers,
          activeAlerts: alerts.count  ?? MOCK.activeAlerts,
          processingRuns: runs.data   ?? MOCK.processingRuns,
        });
      } catch (err) {
        setError(err.message);
        setData(MOCK); // fallback
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { data, loading, error };
}
