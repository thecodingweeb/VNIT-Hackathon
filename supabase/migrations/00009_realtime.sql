-- =============================================================================
-- Migration 00009: Supabase Realtime Configuration
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Replaces Redis LISTEN/NOTIFY + custom WebSocket handlers with
-- Supabase Realtime postgres_changes subscriptions.
--
-- Enabled on:
--   1. alerts — Real-time alert feed on the dashboard
--   2. processing_runs — Live run progress updates
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Realtime on specific tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Realtime listens to the `supabase_realtime` publication.
-- We add only the tables that need real-time push to the frontend.

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_runs;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Realtime subscription happens on the client side via supabase-js:
-- ─────────────────────────────────────────────────────────────────────────────
--
-- // Subscribe to new alerts (INSERT events)
-- supabase
--   .channel('realtime-alerts')
--   .on('postgres_changes', {
--     event: 'INSERT',
--     schema: 'public',
--     table: 'alerts'
--   }, (payload) => handleNewAlert(payload.new))
--   .subscribe();
--
-- // Subscribe to run progress updates (UPDATE events)
-- supabase
--   .channel('run-progress')
--   .on('postgres_changes', {
--     event: 'UPDATE',
--     schema: 'public',
--     table: 'processing_runs',
--     filter: `id=eq.${runId}`
--   }, (payload) => handleRunProgress(payload.new))
--   .subscribe();
--
-- ─────────────────────────────────────────────────────────────────────────────
