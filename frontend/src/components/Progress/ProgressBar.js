


import React from 'react';

export const ProgressBar = ({ progress, stage, message, className = '' }) => {
  const getStageColor = (stage) => {
    switch (stage) {
      case 'setup':
      case 'config':
        return '#3b82f6';
      case 'agents':
        return '#6366f1';
      case 'simulation':
        return '#22c55e';
      case 'finalization':
        return '#f59e0b';
      case 'completed':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStageLabel = (stage) => {
    switch (stage) {
      case 'setup': return 'Setup';
      case 'config': return 'Configuration';
      case 'agents': return 'Agent Initialization';
      case 'simulation': return 'Running Simulation';
      case 'finalization': return 'Finalizing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Processing';
    }
  };

  return (
    <div className={`progress-container ${className}`}>
      {}
      <div className="progress-header">
        <div className="progress-stage">
          <span className="stage-label">{getStageLabel(stage)}</span>
          {stage && (
            <span className="stage-badge" style={{ backgroundColor: getStageColor(stage) }}>
              {stage}
            </span>
          )}
        </div>
        <span className="progress-percentage">
          {Math.round(progress)}%
        </span>
      </div>

      {}
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: getStageColor(stage)
          }}
        >
          <div className="progress-shimmer" />
        </div>
      </div>

      {}
      {message && (
        <p className="progress-message">{message}</p>
      )}
    </div>
  );
};