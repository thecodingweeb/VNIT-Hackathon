import React, { useState } from 'react';
import {
  Check, X, UserPlus, SkipForward, Camera,
  Sparkles, Layers, SlidersHorizontal, Eye,
  ChevronRight, ArrowRight, ShieldCheck, Clock
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import './ReviewQueue.css';

const MOCK_QUEUE = [
  {
    id: 'REV-0817-001',
    station: 'ST-18 (Turia Gate)',
    timestamp: '17 Aug 2026, 13:42',
    capturedFlank: 'Left Flank',
    quality: 'Good (88%)',
    newImage: '/images/tiger_hero.jpg',
    topCandidates: [
      { id: 'PTR-T-007', similarity: 78.6, flank: 'Left Flank', image: '/images/tiger_2.jpg', lastSeen: 'ST-16 · 16 Aug' },
      { id: 'PTR-T-014', similarity: 72.1, flank: 'Left Flank', image: '/images/tiger_hero.jpg', lastSeen: 'ST-42 · Today' },
      { id: 'PTR-T-021', similarity: 65.4, flank: 'Left Flank', image: '/images/tiger_3.jpg', lastSeen: 'ST-09 · 15 Aug' },
      { id: 'PTR-T-003', similarity: 61.7, flank: 'Left Flank', image: '/images/tiger_hero.jpg', lastSeen: 'ST-12 · 01 Aug' },
      { id: 'PTR-T-011', similarity: 60.2, flank: 'Left Flank', image: '/images/tiger_4.jpg', lastSeen: 'ST-37 · 2 days ago' },
    ]
  },
  {
    id: 'REV-0817-002',
    station: 'ST-42 (Kohka Ridge)',
    timestamp: '17 Aug 2026, 11:20',
    capturedFlank: 'Right Flank',
    quality: 'Excellent (95%)',
    newImage: '/images/tiger_2.jpg',
    topCandidates: [
      { id: 'PTR-T-001', similarity: 82.4, flank: 'Right Flank', image: '/images/tiger_hero.jpg', lastSeen: 'ST-42 · Today' },
      { id: 'PTR-T-041', similarity: 69.8, flank: 'Right Flank', image: '/images/tiger_4.jpg', lastSeen: 'ST-12 · 14 Aug' },
      { id: 'PTR-T-095', similarity: 63.5, flank: 'Right Flank', image: '/images/tiger_5.jpg', lastSeen: 'ST-33 · 08 Aug' },
    ]
  }
];

export default function ReviewQueue() {
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);
  const [filterTab, setFilterTab] = useState('Unreviewed');

  const currentItem = queue[currentIndex];
  const activeCandidate = currentItem?.topCandidates[selectedCandidateIdx];

  const handleAction = (actionType) => {
    if (queue.length > 1) {
      const nextQueue = queue.filter((_, i) => i !== currentIndex);
      setQueue(nextQueue);
      setCurrentIndex(0);
      setSelectedCandidateIdx(0);
    } else {
      setQueue([]);
    }
  };

  if (!currentItem || queue.length === 0) {
    return (
      <div className="review-empty-state">
        <ShieldCheck size={64} className="review-empty-icon" />
        <h2 className="review-empty-title">All Detections Verified!</h2>
        <p className="review-empty-desc">The human verification queue is completely clear. No pending stripe matches require attention.</p>
        <button className="cat-btn-primary" onClick={() => setQueue(MOCK_QUEUE)}>
          Reload Demonstration Queue
        </button>
      </div>
    );
  }

  return (
    <div className="review-queue-page">
      {/* Header */}
      <div className="review-header">
        <div>
          <h1 className="review-title">Review Queue</h1>
          <p className="review-subtitle">
            <span className="font-mono" style={{ color: 'var(--accent)' }}>{queue.length}</span> detections require human verification
          </p>
        </div>
        <div className="review-filter-tabs">
          {['Unreviewed', 'Assigned to me', 'Low quality', 'Recently added'].map(tab => (
            <button
              key={tab}
              className={`review-tab-btn ${filterTab === tab ? 'review-tab-btn--active' : ''}`}
              onClick={() => setFilterTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Workspace */}
      <div className="review-workspace">
        {/* Left Side: Side-by-Side Image Comparison */}
        <div className="review-comparison-card">
          <div className="comparison-grid">
            {/* New Detection */}
            <div className="comparison-box">
              <div className="comparison-badge-header">
                <span className="box-title">New Detection</span>
                <Badge variant="warning">Pending Match</Badge>
              </div>
              <div className="comparison-image-wrap">
                <img src={currentItem.newImage} alt="New Detection" className="comparison-image" />
                <div className="image-overlay-info">
                  <span>{currentItem.station}</span>
                  <span className="font-mono">{currentItem.timestamp}</span>
                </div>
              </div>
              <div className="detection-meta-bar">
                <div>
                  <span className="meta-k">Flank:</span>
                  <span className="meta-v">{currentItem.capturedFlank}</span>
                </div>
                <div>
                  <span className="meta-k">Detection Quality:</span>
                  <span className="meta-v" style={{ color: 'var(--color-success)' }}>{currentItem.quality}</span>
                </div>
              </div>
            </div>

            {/* Candidate Match Reference */}
            <div className="comparison-box">
              <div className="comparison-badge-header">
                <span className="box-title">Catalogue Reference: <span className="font-mono text-accent-gradient">{activeCandidate?.id}</span></span>
                <span className="similarity-pill font-mono" style={{
                  color: activeCandidate?.similarity > 75 ? 'var(--color-success)' : 'var(--color-warning)'
                }}>
                  Similarity {activeCandidate?.similarity}%
                </span>
              </div>
              <div className="comparison-image-wrap">
                <img src={activeCandidate?.image} alt={activeCandidate?.id} className="comparison-image" />
                <div className="image-overlay-info">
                  <span>{activeCandidate?.flank}</span>
                  <span className="font-mono">{activeCandidate?.lastSeen}</span>
                </div>
              </div>
              <div className="detection-meta-bar">
                <div>
                  <span className="meta-k">Catalogue ID:</span>
                  <span className="meta-v font-mono">{activeCandidate?.id}</span>
                </div>
                <div>
                  <span className="meta-k">Stripe Match:</span>
                  <span className="meta-v font-mono">{activeCandidate?.similarity}% Siamese-CNN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="review-action-toolbar">
            <div className="keyboard-hints">
              <span>Shortcuts:</span>
              <kbd>C</kbd> Confirm
              <kbd>R</kbd> Reject
              <kbd>N</kbd> New Individual
              <kbd>S</kbd> Skip
            </div>

            <div className="action-buttons-group">
              <button className="rev-btn rev-btn--confirm" onClick={() => handleAction('confirm')}>
                <Check size={16} />
                <span>Confirm Match ({activeCandidate?.id})</span>
              </button>
              <button className="rev-btn rev-btn--reject" onClick={() => handleAction('reject')}>
                <X size={16} />
                <span>Reject Match</span>
              </button>
              <button className="rev-btn rev-btn--new" onClick={() => handleAction('new_individual')}>
                <UserPlus size={16} />
                <span>Enroll New Tiger ID</span>
              </button>
              <button className="rev-btn rev-btn--skip" onClick={() => handleAction('skip')}>
                <SkipForward size={16} />
                <span>Skip</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Top Candidates Ranking List */}
        <div className="review-candidates-sidebar">
          <div className="candidates-header">
            <h3 className="candidates-title">Top Re-ID Candidates</h3>
            <span className="candidates-count font-mono">{currentItem.topCandidates.length} matches</span>
          </div>

          <div className="candidates-list">
            {currentItem.topCandidates.map((cand, idx) => (
              <div
                key={cand.id}
                className={`candidate-card ${selectedCandidateIdx === idx ? 'candidate-card--active' : ''}`}
                onClick={() => setSelectedCandidateIdx(idx)}
              >
                <div className="cand-rank font-mono">{idx + 1}</div>
                <img src={cand.image} alt={cand.id} className="cand-thumb" />
                <div className="cand-details">
                  <div className="cand-top-row">
                    <span className="cand-id font-mono font-bold text-accent">{cand.id}</span>
                    <span className="cand-sim font-mono">{cand.similarity}%</span>
                  </div>
                  <div className="cand-last font-mono">{cand.lastSeen}</div>
                  <div className="cand-score-bar-bg">
                    <div
                      className="cand-score-bar-fill"
                      style={{
                        width: `${cand.similarity}%`,
                        background: cand.similarity > 75 ? 'var(--color-success)' : 'var(--accent)'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
