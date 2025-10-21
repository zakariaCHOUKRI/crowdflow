// Replace the entire component with this updated version:
import React, { useState, useCallback, useEffect } from 'react';
import '../styles/journey-assignment.css';

const JourneyAssignmentTool = ({ 
  journeyConnections, 
  onJourneyConnectionsChange,
  elements,
  selectedJourneyId,
  onSelectedJourneyChange
}) => {
//   const [selectedJourneyId, onSelectedJourneyChange] = useState('J1');

  // Get unique journey IDs
  const existingJourneys = React.useMemo(() => {
    const journeyIds = new Set();
    journeyConnections.forEach(conn => {
      if (conn.journeyId && conn.journeyId.trim() !== '') {
        journeyIds.add(conn.journeyId);
      }
    });
    return Array.from(journeyIds).sort((a, b) => {
      const aNum = parseInt(a.replace('J', '')) || 0;
      const bNum = parseInt(b.replace('J', '')) || 0;
      return aNum - bNum;
    }); 
  }, [journeyConnections]);

  // Generate new journey ID safely
  const generateJourneyId = useCallback(() => {
    let maxNumber = 0;
    existingJourneys.forEach(journeyId => {
      const match = journeyId.match(/^J(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    return `J${maxNumber + 1}`;
  }, [existingJourneys]);

  // Add new journey
  const addNewJourney = useCallback(() => {
    const newJourneyId = generateJourneyId();
    onSelectedJourneyChange(newJourneyId);
  }, [generateJourneyId, onSelectedJourneyChange]);

  // Delete journey
  const deleteJourney = useCallback((journeyId) => {
    const updatedConnections = journeyConnections.filter(conn => conn.journeyId !== journeyId);
    onJourneyConnectionsChange(updatedConnections);
    
    // If we deleted the selected journey, select another one or create new
    if (selectedJourneyId === journeyId) {
      const remainingJourneys = updatedConnections.map(conn => conn.journeyId);
      const uniqueRemaining = [...new Set(remainingJourneys)].filter(id => id && id.trim() !== '');
      
      if (uniqueRemaining.length > 0) {
        onSelectedJourneyChange(uniqueRemaining[0]);
      } else {
        onSelectedJourneyChange('J1');
      }
    }
  }, [journeyConnections, onJourneyConnectionsChange, selectedJourneyId]);

  // Auto-select first journey if none selected
  useEffect(() => {
  if ((!selectedJourneyId || selectedJourneyId.trim() === '') && existingJourneys.length > 0) {
    onSelectedJourneyChange(existingJourneys[0]);
  }
}, []);

  const getJourneyColor = (journeyId) => {
  const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280',
  '#22d3ee', '#eab308', '#a855f7', '#f43f5e', '#14b8a6',
  '#d946ef', '#4ade80', '#0ea5e9', '#facc15', '#fda4af',
  '#93c5fd', '#fb923c', '#2dd4bf', '#fde047', '#c084fc',
  '#fcd34d', '#34d399', '#f87171', '#60a5fa', '#bbf7d0'
];

  const match = journeyId.match(/^J(\d+)$/);
  const journeyNumber = match ? parseInt(match[1]) - 1 : 0;
  return colors[journeyNumber % colors.length];
};

  return (
    <div className="journey-assignment-tool">
      <div className="journey-assignment-header">
        <h3>Journey Assignment</h3>
        <p>Select a journey to assign to connections</p>
      </div>

      <div className="journey-selection">
        <div className="current-journey">
          <label>Current Journey:</label>
          <select 
            value={selectedJourneyId}
            onChange={(e) => onSelectedJourneyChange(e.target.value)}
            className="journey-select"
          >
            {existingJourneys.map(journeyId => (
              <option key={journeyId} value={journeyId}>
                {journeyId}
              </option>
            ))}
            {!existingJourneys.includes(selectedJourneyId) && (
              <option value={selectedJourneyId}>{selectedJourneyId}</option>
            )}
          </select>
          <div 
            className="journey-color-indicator"
            style={{ backgroundColor: getJourneyColor(selectedJourneyId) }}
          ></div>
        </div>

        <div className="journey-actions">
          <button 
            onClick={addNewJourney}
            className="add-journey-btn"
          >
            + New Journey
          </button>
        </div>
      </div>

      {existingJourneys.length > 0 && (
        <div className="journey-list">
          <h4>Existing Journeys</h4>
          {existingJourneys.map(journeyId => {
            const journeyConnections_filtered = journeyConnections.filter(conn => conn.journeyId === journeyId);
            const connectionCount = journeyConnections_filtered.length;
            
            return (
              <div key={journeyId} className="journey-item">
                <div className="journey-info">
                  <div 
                    className="journey-color-dot"
                    style={{ backgroundColor: getJourneyColor(journeyId) }}
                  ></div>
                  <span className="journey-name">{journeyId}</span>
                  <span className="connection-count">({connectionCount} connections)</span>
                </div>
                <button
                  onClick={() => deleteJourney(journeyId)}
                  className="delete-journey-btn"
                  title="Delete journey"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

     

      {/* Hidden input to store selected journey for canvas interaction */}
      <input 
        type="hidden" 
        data-selected-journey={selectedJourneyId}
        data-journey-color={getJourneyColor(selectedJourneyId)}
      />
    </div>
  );
};

export default JourneyAssignmentTool;