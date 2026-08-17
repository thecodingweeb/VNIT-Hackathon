import React from 'react';
import Badge from '../ui/Badge';
import './ProcessingRunsTable.css';

export default function ProcessingRunsTable({ runs = [] }) {
  return (
    <div className="runs-table-wrapper">
      <table className="runs-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Status</th>
            <th>Date</th>
            <th>Images</th>
            <th>Detections</th>
            <th>New Tigers</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.id} className="runs-table-row">
              <td>
                <span className="run-id font-mono">{run.id}</span>
              </td>
              <td>
                <Badge variant={run.status}>{run.status}</Badge>
              </td>
              <td>
                <span className="run-date">{run.date}</span>
              </td>
              <td>
                <span className="run-num font-mono">{run.images}</span>
              </td>
              <td>
                <span className="run-num font-mono">{run.detections.toLocaleString()}</span>
              </td>
              <td>
                <span className={`run-num font-mono ${run.newEnrollments > 0 ? 'run-num--accent' : ''}`}>
                  {run.newEnrollments}
                </span>
              </td>
              <td>
                <span className={`run-num font-mono ${run.alerts > 0 ? 'run-num--warning' : ''}`}>
                  {run.alerts}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
