import React, { useState } from 'react';
import {
  Settings as SettingsIcon, Shield, Sliders, Database,
  Bell, Cpu, Users, Save, Check, RefreshCw, Key,
  Radio, HardDrive, AlertTriangle, Eye, Lock
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import './Settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [saved, setSaved] = useState(false);

  // Settings State
  const [pipelineSettings, setPipelineSettings] = useState({
    megaDetectorThreshold: 0.75,
    siameseMatchThreshold: 0.85,
    provisionalThreshold: 0.65,
    autoEnrollEnabled: true,
    batchSize: 64,
    gpuAcceleration: true,
    modelWeights: 'siamese_cnn_pench_v2.1.pt',
  });

  const [alertSettings, setAlertSettings] = useState({
    bufferZoneDistanceKm: 5.0,
    absenceAlertDays: 10,
    notifyOnNewIndividual: true,
    notifyOnNovelStation: true,
    notifyOnBufferApproach: true,
    officerNotificationEmail: 'ranger.pench@forest.mp.gov.in',
    emergencySmsEnabled: true,
  });

  const [supabaseConfig, setSupabaseConfig] = useState({
    supabaseUrl: 'https://xyzcompany.supabase.co',
    supabaseKey: '••••••••••••••••••••••••••••••••••••••••••••',
    syncIntervalMin: 15,
    enableRealtime: true,
    offlineCache: true,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">System Settings</h1>
          <p className="settings-subtitle">Configure AI detection pipelines, alert thresholds, backend syncing & team access</p>
        </div>
        <button className="cat-btn-primary" onClick={handleSave}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? 'Saved Successfully' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-container">
        {/* Navigation Tabs */}
        <div className="settings-sidebar">
          {[
            { id: 'pipeline', label: 'AI & Identification', icon: Cpu },
            { id: 'alerts', label: 'Alert Triggers', icon: Bell },
            { id: 'database', label: 'Supabase & Storage', icon: Database },
            { id: 'stations', label: 'Station Defaults', icon: Radio },
            { id: 'users', label: 'Rangers & Access', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`settings-nav-item ${activeTab === id ? 'settings-nav-item--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content Area */}
        <div className="settings-content">
          {/* AI & Identification */}
          {activeTab === 'pipeline' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="settings-card-header">
                  <Cpu size={18} className="settings-card-icon" />
                  <div>
                    <h3 className="settings-card-title">Computer Vision & Re-ID Thresholds</h3>
                    <p className="settings-card-desc">Control automated stripe feature matching & verification strictness</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="form-group-slider">
                    <div className="form-label-row">
                      <label>MegaDetector Confidence Threshold</label>
                      <span className="slider-value font-mono">{(pipelineSettings.megaDetectorThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="0.99"
                      step="0.01"
                      value={pipelineSettings.megaDetectorThreshold}
                      onChange={(e) => setPipelineSettings({ ...pipelineSettings, megaDetectorThreshold: parseFloat(e.target.value) })}
                      className="settings-slider"
                    />
                    <span className="form-help">Minimum animal detection certainty required before stripe extraction.</span>
                  </div>

                  <div className="form-group-slider">
                    <div className="form-label-row">
                      <label>Siamese Re-ID Auto-Match Threshold</label>
                      <span className="slider-value font-mono">{(pipelineSettings.siameseMatchThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.70"
                      max="0.99"
                      step="0.01"
                      value={pipelineSettings.siameseMatchThreshold}
                      onChange={(e) => setPipelineSettings({ ...pipelineSettings, siameseMatchThreshold: parseFloat(e.target.value) })}
                      className="settings-slider"
                    />
                    <span className="form-help">Matches above this score are automatically assigned to known catalogue IDs without human review.</span>
                  </div>

                  <div className="form-group-slider">
                    <div className="form-label-row">
                      <label>Provisional Candidate Threshold</label>
                      <span className="slider-value font-mono">{(pipelineSettings.provisionalThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.40"
                      max="0.80"
                      step="0.01"
                      value={pipelineSettings.provisionalThreshold}
                      onChange={(e) => setPipelineSettings({ ...pipelineSettings, provisionalThreshold: parseFloat(e.target.value) })}
                      className="settings-slider"
                    />
                    <span className="form-help">Scores between Provisional and Auto-Match are sent to the Review Queue for ranger verification.</span>
                  </div>

                  <div className="form-toggle-row">
                    <div>
                      <div className="toggle-label">Auto-Enroll Novel Individuals</div>
                      <div className="form-help">Automatically create provisional profile when no catalogue candidate exceeds threshold.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={pipelineSettings.autoEnrollEnabled}
                      onChange={(e) => setPipelineSettings({ ...pipelineSettings, autoEnrollEnabled: e.target.checked })}
                      className="settings-checkbox"
                    />
                  </div>

                  <div className="form-input-row">
                    <div className="form-group">
                      <label>Active Neural Network Weights</label>
                      <input
                        type="text"
                        value={pipelineSettings.modelWeights}
                        disabled
                        className="cat-form-input font-mono"
                      />
                    </div>
                    <div className="form-group">
                      <label>Batch Size (Images per GPU step)</label>
                      <input
                        type="number"
                        value={pipelineSettings.batchSize}
                        onChange={(e) => setPipelineSettings({ ...pipelineSettings, batchSize: parseInt(e.target.value) })}
                        className="cat-form-input font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alert Triggers */}
          {activeTab === 'alerts' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="settings-card-header">
                  <Bell size={18} className="settings-card-icon" />
                  <div>
                    <h3 className="settings-card-title">Automated Alert Triggers</h3>
                    <p className="settings-card-desc">Define perimeter thresholds and absence detection intervals</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="form-input-row">
                    <div className="form-group">
                      <label>Buffer Zone Proximity Warning (km)</label>
                      <input
                        type="number"
                        value={alertSettings.bufferZoneDistanceKm}
                        onChange={(e) => setAlertSettings({ ...alertSettings, bufferZoneDistanceKm: parseFloat(e.target.value) })}
                        className="cat-form-input font-mono"
                      />
                      <span className="form-help">Triggers HIGH priority alert when individual approaches village boundary within this range.</span>
                    </div>

                    <div className="form-group">
                      <label>Prolonged Absence Trigger (Days)</label>
                      <input
                        type="number"
                        value={alertSettings.absenceAlertDays}
                        onChange={(e) => setAlertSettings({ ...alertSettings, absenceAlertDays: parseInt(e.target.value) })}
                        className="cat-form-input font-mono"
                      />
                      <span className="form-help">Alert when an active catalogue tiger is missing across all stations for X days.</span>
                    </div>
                  </div>

                  <div className="form-toggle-row">
                    <div>
                      <div className="toggle-label">Buffer Approach Notifications</div>
                      <div className="form-help">Send immediate high-priority alerts for tigers moving towards human settlements.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={alertSettings.notifyOnBufferApproach}
                      onChange={(e) => setAlertSettings({ ...alertSettings, notifyOnBufferApproach: e.target.checked })}
                      className="settings-checkbox"
                    />
                  </div>

                  <div className="form-toggle-row">
                    <div>
                      <div className="toggle-label">Novel Camera Station Trigger</div>
                      <div className="form-help">Alert when an individual is identified at a station outside its 95% KDE home range.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={alertSettings.notifyOnNovelStation}
                      onChange={(e) => setAlertSettings({ ...alertSettings, notifyOnNovelStation: e.target.checked })}
                      className="settings-checkbox"
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label>Ranger Dispatch Alert Email</label>
                    <input
                      type="email"
                      value={alertSettings.officerNotificationEmail}
                      onChange={(e) => setAlertSettings({ ...alertSettings, officerNotificationEmail: e.target.value })}
                      className="cat-form-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Supabase & Storage */}
          {activeTab === 'database' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="settings-card-header">
                  <Database size={18} className="settings-card-icon" />
                  <div>
                    <h3 className="settings-card-title">Supabase Backend Integration</h3>
                    <p className="settings-card-desc">Configure cloud database synchronization, storage buckets & offline caching</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="form-group">
                    <label>Supabase Project URL</label>
                    <input
                      type="text"
                      value={supabaseConfig.supabaseUrl}
                      onChange={(e) => setSupabaseConfig({ ...supabaseConfig, supabaseUrl: e.target.value })}
                      className="cat-form-input font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label>Anon / Service Role Key</label>
                    <div className="cat-search-wrap">
                      <input
                        type="password"
                        value={supabaseConfig.supabaseKey}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, supabaseKey: e.target.value })}
                        className="cat-form-input font-mono"
                      />
                    </div>
                  </div>

                  <div className="form-toggle-row">
                    <div>
                      <div className="toggle-label">Realtime Table Subscriptions (WebSockets)</div>
                      <div className="form-help">Instant live updates when new detections or alerts are recorded.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={supabaseConfig.enableRealtime}
                      onChange={(e) => setSupabaseConfig({ ...supabaseConfig, enableRealtime: e.target.checked })}
                      className="settings-checkbox"
                    />
                  </div>

                  <div className="form-toggle-row">
                    <div>
                      <div className="toggle-label">Field Station Offline Cache (IndexedDB)</div>
                      <div className="form-help">Enables forest officers in zero-connectivity sectors to view cached maps and catalogues.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={supabaseConfig.offlineCache}
                      onChange={(e) => setSupabaseConfig({ ...supabaseConfig, offlineCache: e.target.checked })}
                      className="settings-checkbox"
                    />
                  </div>

                  <div className="database-status-card">
                    <div className="db-status-row">
                      <span className="db-status-dot db-status-dot--online" />
                      <span className="db-status-text">Connected to Supabase PostgreSQL</span>
                      <Badge variant="success">Tables Synced</Badge>
                    </div>
                    <div className="db-stats-mini font-mono">
                      <span>Records: 14,320</span>
                      <span>·</span>
                      <span>Storage: 4.8 GB</span>
                      <span>·</span>
                      <span>Latency: 38ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stations & Defaults */}
          {activeTab === 'stations' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="settings-card-header">
                  <Radio size={18} className="settings-card-icon" />
                  <div>
                    <h3 className="settings-card-title">Camera Station Network Defaults</h3>
                    <p className="settings-card-desc">Sensor polling intervals, battery warning thresholds and map projections</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="form-input-row">
                    <div className="form-group">
                      <label>Battery Warning Threshold (%)</label>
                      <input type="number" defaultValue={20} className="cat-form-input font-mono" />
                    </div>
                    <div className="form-group">
                      <label>Heartbeat Offline Timeout (Hours)</label>
                      <input type="number" defaultValue={24} className="cat-form-input font-mono" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reserve Geographic Datum</label>
                    <select className="cat-form-input">
                      <option>WGS 84 (EPSG:4326) - Standard GPS</option>
                      <option>UTM Zone 44N (EPSG:32644) - Central India</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rangers & Access */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="settings-card-header">
                  <Users size={18} className="settings-card-icon" />
                  <div>
                    <h3 className="settings-card-title">Authorized Field Officers & Access Control</h3>
                    <p className="settings-card-desc">Team credentials and role-based permissions</p>
                  </div>
                </div>

                <div className="officers-list">
                  {[
                    { name: 'Ranger Amit Sharma', role: 'Chief Wildlife Warden', email: 'amit.sharma@forest.mp.gov.in', status: 'Active', zone: 'Pench Core' },
                    { name: 'Dr. Priya Desai', role: 'Senior Biologist / Re-ID Specialist', email: 'priya.desai@wii.gov.in', status: 'Active', zone: 'Research Wing' },
                    { name: 'Officer Rajesh Verma', role: 'Field Patrol Officer', email: 'r.verma@forest.mp.gov.in', status: 'Active', zone: 'Turia & Buffer' },
                    { name: 'Sunil Kumar', role: 'Station Maintenance Tech', email: 'sunil.k@pench.gov.in', status: 'Active', zone: 'All Sectors' },
                  ].map((user, i) => (
                    <div key={i} className="officer-row">
                      <div className="officer-avatar font-mono">{user.name.split(' ').map(n=>n[0]).join('')}</div>
                      <div className="officer-info">
                        <div className="officer-name">{user.name}</div>
                        <div className="officer-email font-mono">{user.email} · <span style={{ color: 'var(--accent)' }}>{user.zone}</span></div>
                      </div>
                      <Badge variant="active">{user.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
