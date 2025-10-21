import { ProgressBar } from './ProgressBar';

export const SimulationProgressModal = ({ 
  isOpen, 
  progress, 
  onCancel, 
  onClose 
}) => {
  if (!isOpen) return null;

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const isCompleted = progress.stage === 'completed';
  const isFailed = progress.stage === 'failed';

  return (
    <div className="modal-overlay">
      <div className="modal simulation-progress-modal">
        {}
        <div className="modal-header">
          <h3 className="modal-title">
            {isCompleted ? 'Simulation Completed' : 
             isFailed ? 'Simulation Failed' : 
             'Running Simulation'}
          </h3>
          {isCompleted && (
            <button
              onClick={onClose}
              className="modal-close-btn"
            >
              ✕
            </button>
          )}
        </div>

        {}
        <div className="modal-content">
          <ProgressBar 
            progress={progress.progress}
            stage={progress.stage}
            message={progress.message}
          />
        </div>

        {}
        {progress.error && (
          <div className="status-card status-card-error">
            <p>{progress.error}</p>
          </div>
        )}

        {}
        {isCompleted && progress.results && (
          <div className="status-card status-card-success">
            <h4>Results Summary</h4>
            <div className="results-grid">
              <div>Total Agents: {progress.results.total_agents}</div>
              <div>Evacuated: {progress.results.agents_evacuated}</div>
              <div>Evacuation Time: {progress.results.evacuation_time}s</div>
              {/* <div>{progress.results.success ? 'All agents evacuated' : 'Not all agents evacuated'}</div> */}
              <div>Execution Time: {progress.results.execution_time}s</div>
            </div>
          </div>
        )}

        {}
        <div className="modal-actions">
          {!isCompleted && !isFailed && (
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}

          {isCompleted && progress.results && (
            <button
              onClick={onClose}
              className="btn btn-primary"
            >
              View Results
            </button>
          )}
          
          {isFailed && (
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};