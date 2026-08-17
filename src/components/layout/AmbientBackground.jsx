import React from 'react';
import './AmbientBackground.css';

export default function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-blob ambient-blob--amber" />
      <div className="ambient-blob ambient-blob--green" />
      <div className="ambient-blob ambient-blob--indigo" />
      <div className="ambient-noise" />
      <div className="ambient-grid" />
    </div>
  );
}
