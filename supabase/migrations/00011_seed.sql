-- =============================================================================
-- Migration 00011: Seed Data
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Initial seed data for:
--   1. System configuration defaults (alert thresholds, ML parameters)
--   2. Sample camera trap stations (Pench Tiger Reserve)
--   3. Default AI model registry entries
-- =============================================================================
-- NOTE: Default admin user is created via Supabase Auth signup with
--       raw_user_meta_data: { "role": "ADMIN", "username": "admin", "full_name": "System Admin" }
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. System Configuration Defaults
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.system_config (key, value, description) VALUES

-- Blank filtering thresholds
('filtering.md_confidence_threshold', '0.15',
 'MegaDetector V6 confidence threshold for blank classification. Images with max detection conf below this are quarantined.'),

('filtering.burst_logic_enabled', 'true',
 'Enable burst-mode logic: if any image in a 3-second burst has detection, retain all images in the burst.'),

('filtering.burst_window_seconds', '3',
 'Time window (seconds) for grouping images into bursts from the same station.'),

-- Tiger detection thresholds
('detection.tiger_confidence', '0.4',
 'YOLOv8-L minimum confidence for tiger detection.'),

('detection.crop_padding_percent', '15',
 'Percentage padding added to bounding box before cropping for flank extraction.'),

('detection.crop_size', '448',
 'Target crop dimension (pixels) for tiger flank crops.'),

-- Identity matching thresholds
('matching.auto_threshold', '0.85',
 'Cosine similarity >= this → AUTO_MATCH. Automatically assigned to individual.'),

('matching.review_threshold', '0.60',
 'Cosine similarity between review_threshold and auto_threshold → REVIEW_QUEUE.'),

('matching.reference_update_weight', '0.10',
 'Weight for exponential moving average update of reference embeddings on auto-match.'),

-- Alert rule thresholds
('alerts.range_shift_core_sqkm', '15',
 'Core area shift threshold (sq km) to trigger RANGE_SHIFT alert.'),

('alerts.range_shift_buffer_km', '5',
 'Buffer zone linear displacement (km) to trigger RANGE_SHIFT alert.'),

('alerts.novel_station_high_km', '5',
 'Distance from range (km) for HIGH confidence NOVEL_STATION alert.'),

('alerts.novel_station_med_km', '2',
 'Distance from range (km) for MEDIUM confidence NOVEL_STATION alert.'),

('alerts.prolonged_absence_escalation', '{"1": "LOW", "2": "MEDIUM", "3": "HIGH"}',
 'Escalation ladder for PROLONGED_ABSENCE: miss count → confidence level.'),

-- Quarantine settings
('quarantine.auto_expiry_days', '30',
 'Days before quarantined images are eligible for permanent deletion.'),

-- KDE computation parameters
('occupancy.kde_bandwidth', '"auto"',
 'KDE bandwidth selection method: "auto" (Silverman rule), or numeric value.'),

('occupancy.kde_grid_resolution', '200',
 'Grid resolution for KDE computation.'),

('occupancy.mcp_percentile', '95',
 'Minimum Convex Polygon percentile for home range estimation.'),

-- System settings
('system.timezone_display', '"Asia/Kolkata"',
 'Display timezone for the UI (all data stored in UTC).'),

('system.thumbnail_size', '256',
 'Thumbnail dimension (pixels) for quick-loading previews.'),

('system.max_upload_size_mb', '10240',
 'Maximum ZIP archive upload size in MB (10 GB default).'),

('system.pench_reserve_boundary', '"pending"',
 'GeoJSON polygon of Pench Tiger Reserve boundary. To be loaded from official NTCA shapefile.')

ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sample Camera Trap Stations (Pench Tiger Reserve — Madhya Pradesh Core)
-- ─────────────────────────────────────────────────────────────────────────────
-- These are representative sample stations. Real coordinates should be loaded
-- from the official PTR station registry.

INSERT INTO public.stations (station_code, station_name, location, zone, nearest_village, village_dist_km) VALUES
('ST-01', 'Alikatta Nallah',     ST_SetSRID(ST_MakePoint(79.2340, 21.7120), 4326), 'core',             'Turia',         8.2),
('ST-02', 'Bodhanala',           ST_SetSRID(ST_MakePoint(79.2510, 21.7250), 4326), 'core',             'Turia',         6.5),
('ST-03', 'Chindimatta',         ST_SetSRID(ST_MakePoint(79.2680, 21.7380), 4326), 'core',             'Khawasa',       7.1),
('ST-04', 'Dudhgaon Nallah',     ST_SetSRID(ST_MakePoint(79.2150, 21.6950), 4326), 'core',             'Rukhad',        9.0),
('ST-05', 'Raiyakasa',           ST_SetSRID(ST_MakePoint(79.1980, 21.6800), 4326), 'core',             'Rukhad',       10.3),
('ST-06', 'Jamtara Range Post',  ST_SetSRID(ST_MakePoint(79.2850, 21.7500), 4326), 'buffer',           'Jamtara',       2.1),
('ST-07', 'Kurai Village Edge',  ST_SetSRID(ST_MakePoint(79.3020, 21.7620), 4326), 'village_adjacent', 'Kurai',         0.8),
('ST-08', 'Sitaghat Crossing',   ST_SetSRID(ST_MakePoint(79.2200, 21.7050), 4326), 'core',             'Khawasa',       5.4),
('ST-09', 'Wolf Plateau North',  ST_SetSRID(ST_MakePoint(79.2450, 21.7400), 4326), 'core',             'Turia',         7.8),
('ST-10', 'Kolitmara Buffer',    ST_SetSRID(ST_MakePoint(79.3180, 21.7700), 4326), 'buffer',           'Kolitmara',     1.5)

ON CONFLICT (station_code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Default AI Model Registry Entries
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.models (model_name, version, weights_path, is_active, input_size, output_dim, description) VALUES
('megadetector_v6',     'v6.0',     'models/megadetector_v6.pt',     true,  1280, NULL, 'MegaDetector V6 (YOLOv9-C) — Camera trap blank image filtering. Recall >95%.'),
('tiger_yolov8l',       'v1.0',     'models/tiger_yolov8l.pt',       true,  640,  NULL, 'Fine-tuned YOLOv8-L for tiger-specific detection. Min confidence: 0.4.'),
('siamese_densenet169', 'v1.0',     'models/siamese_densenet169.pt', true,  448,  512,  'Siamese CNN (DenseNet-169 backbone) — 512-d stripe pattern embedding extraction. Rank-1 >90%.'),
('flank_classifier',    'v1.0',     'models/flank_classifier.pt',    false, 224,  2,    'Left/Right flank side classifier. Binary output.')

ON CONFLICT (model_name, version) DO NOTHING;
