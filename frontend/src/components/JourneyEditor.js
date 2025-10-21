import React, { useState, useEffect, useCallback } from 'react';
import '../styles/journey-editor.css';

const JourneyEditor = ({ 
  elements, 
  journeyConnections, 
  onJourneyConnectionsChange,
  waypointRouting = {},
  onWaypointRoutingChange,
  selectedWaypoint,           
  onSelectedWaypointChange
}) => {
//   const [selectedWaypoint, setSel    ectedWaypoint] = useState(null);

  const [expandedJourneys, setExpandedJourneys] = useState(new Set());

  const toggleJourneyExpansion = useCallback((waypointId, journeyId) => {
  const key = `${waypointId}-${journeyId}`;
  setExpandedJourneys(prev => {
    const newSet = new Set(prev);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    return newSet;
  });
}, []);
  // Extract journeys from journey connections
  const journeys = React.useMemo(() => {
    const journeyMap = new Map();
    
    journeyConnections.forEach(connection => {
      const journeyId = connection.journeyId;
      if (journeyId && journeyId.trim() !== '') {
        if (!journeyMap.has(journeyId)) {
          journeyMap.set(journeyId, {
            id: journeyId,
            name: journeyId,
            connections: []
          });
        }
        journeyMap.get(journeyId).connections.push(connection);
      }
    });
    
    const result = Array.from(journeyMap.values()).sort((a, b) => {
      const aNum = parseInt(a.id.replace('J', '')) || 0;
      const bNum = parseInt(b.id.replace('J', '')) || 0;
      return aNum - bNum;
    });
    
    return result;
  }, [journeyConnections]);
  // Get possible destinations
  const getPossibleDestinations = useCallback((waypointId) => {
  const destinations = [];
  
  // Add other waypoints (elements.waypoints is an array)
  (elements.waypoints || []).forEach((waypoint, index) => {
    if (waypoint.id !== waypointId) {
      destinations.push({
        id: waypoint.id,
        name: `Waypoint ${index}`,
        type: 'waypoint'
      });
    }
  });
  
  // Add exits (assuming elements.exits is also an array)
  (elements.exits || []).forEach((exit, index) => {
    destinations.push({
      id: exit.id,
      name: `Exit ${index}`,
      type: 'exit'
    });
  });
  
  return destinations;
}, [elements]);
  const createDefaultRouting = useCallback((waypointId, journeyId) => {
  // Get all possible destinations for this waypoint
  const destinations = getPossibleDestinations(waypointId);
  
  if (destinations.length === 0) return;
  
  // Split percentage evenly
  const percentagePerDestination = Math.floor(100 / destinations.length);
  const remainder = 100 % destinations.length;
  
  const defaultDestinations = destinations.map((dest, index) => ({
    target: dest.id,
    percentage: percentagePerDestination + (index < remainder ? 1 : 0)
  }));
  
  const newRouting = { ...waypointRouting };
  
  if (!newRouting[waypointId]) {
    newRouting[waypointId] = {};
  }
  
  newRouting[waypointId][journeyId] = {
    destinations: defaultDestinations
  };
  
  onWaypointRoutingChange(newRouting);
}, [waypointRouting, onWaypointRoutingChange, getPossibleDestinations]);

  // Get journeys that pass through a waypoint - COMPLETELY REWRITTEN
  const getJourneysForWaypoint = useCallback((waypointId) => {
   
    
    if (!waypointId || waypointId === '') {
      return [];
    }

    const matchingJourneys = [];
    
    for (const journey of journeys) {
      
      for (const conn of journey.connections) {
        let fromId = null;
        let toId = null;
        
        // Extract IDs with multiple fallbacks
        if (conn.fromId) fromId = conn.fromId;
        else if (conn.from?.element?.id) fromId = conn.from.element.id;
        else if (conn.from?.id) fromId = conn.from.id;
        
        if (conn.toId) toId = conn.toId;
        else if (conn.to?.element?.id) toId = conn.to.element.id;
        else if (conn.to?.id) toId = conn.to.id;
        
        if (fromId === waypointId || toId === waypointId) {
          matchingJourneys.push(journey);
          break; // Don't add the same journey twice
        }
      }
    }
    

    
    return matchingJourneys;
  }, [journeys, waypointRouting, createDefaultRouting]);

  

  // All the other callback functions (addDestination, removeDestination, etc.) remain the same...
  const addDestination = useCallback((waypointId, journeyId) => {
    const newRouting = { ...waypointRouting };
    
    if (!newRouting[waypointId]) {
      newRouting[waypointId] = {};
    }
    
    if (!newRouting[waypointId][journeyId]) {
      newRouting[waypointId][journeyId] = { destinations: [] };
    }
    
    const currentDestinations = newRouting[waypointId][journeyId].destinations || [];
    const usedPercentage = currentDestinations.reduce((sum, dest) => sum + dest.percentage, 0);
    const remainingPercentage = Math.max(0, 100 - usedPercentage);
    
    const possibleDestinations = getPossibleDestinations(waypointId);
    const unusedDestinations = possibleDestinations.filter(dest => 
      !currentDestinations.some(existing => existing.target === dest.id)
    );
    
    if (unusedDestinations.length > 0) {
      currentDestinations.push({
        target: unusedDestinations[0].id,
        percentage: remainingPercentage || 50
      });
      
      newRouting[waypointId][journeyId].destinations = currentDestinations;
      onWaypointRoutingChange(newRouting);
    }
  }, [waypointRouting, onWaypointRoutingChange, getPossibleDestinations]);

  const removeDestination = useCallback((waypointId, journeyId, targetId) => {
    const newRouting = { ...waypointRouting };
    
    if (newRouting[waypointId] && newRouting[waypointId][journeyId]) {
      newRouting[waypointId][journeyId].destinations = 
        newRouting[waypointId][journeyId].destinations.filter(dest => dest.target !== targetId);
      
      onWaypointRoutingChange(newRouting);
    }
  }, [waypointRouting, onWaypointRoutingChange]);

  const updateDestinationPercentage = useCallback((waypointId, journeyId, targetId, percentage) => {
    const newRouting = { ...waypointRouting };
    
    if (newRouting[waypointId] && newRouting[waypointId][journeyId]) {
      const destinations = newRouting[waypointId][journeyId].destinations;
      const targetIndex = destinations.findIndex(dest => dest.target === targetId);
      
      if (targetIndex !== -1) {
        destinations[targetIndex].percentage = Math.max(0, Math.min(100, percentage));
        onWaypointRoutingChange(newRouting);
      }
    }
  }, [waypointRouting, onWaypointRoutingChange]);

  const updateDestinationTarget = useCallback((waypointId, journeyId, oldTargetId, newTargetId) => {
    const newRouting = { ...waypointRouting };
    
    if (newRouting[waypointId] && newRouting[waypointId][journeyId]) {
      const destinations = newRouting[waypointId][journeyId].destinations;
      const targetIndex = destinations.findIndex(dest => dest.target === oldTargetId);
      
      if (targetIndex !== -1) {
        destinations[targetIndex].target = newTargetId;
        onWaypointRoutingChange(newRouting);
      }
    }
  }, [waypointRouting, onWaypointRoutingChange]);

  const getTotalPercentage = useCallback((waypointId, journeyId) => {
    const routing = waypointRouting[waypointId]?.[journeyId];
    if (!routing || !routing.destinations) return 0;
    
    return routing.destinations.reduce((sum, dest) => sum + (dest.percentage || 0), 0);
  }, [waypointRouting]);


  if (!journeys.length || !(elements.waypoints || []).length) {
  return (
    <div className="journey-editor">
      <div className="journey-editor-header">
        <h3>Journey Routing Editor</h3>
      </div>
      <div className="journey-editor-empty">
        <p>Create journeys and waypoints to configure routing percentages.</p>
        <p>Journeys: {journeys.length}, Waypoints: {(elements.waypoints || []).length}</p>
      </div>
    </div>
  );
}

  return (
    <div className="journey-editor" key={`journey-editor`}>
      <div className="journey-editor-header">
        <h3>Journey Routing Editor</h3>
        <p>Configure percentage splits at waypoints for each journey</p>
      </div>

      <div className="journey-editor-content">
        <div className="waypoint-list">
  <h4>Waypoints</h4>
  {(elements.waypoints || []).map((waypoint, displayIndex) => {
    const actualWaypointId = waypoint.id; // Get the actual ID from the waypoint object
    
    const waypointJourneys = getJourneysForWaypoint(actualWaypointId);
    const hasRouting = waypointRouting[actualWaypointId] && Object.keys(waypointRouting[actualWaypointId]).length > 0;
    
    return (
      <div 
        key={`waypoint-${actualWaypointId}`}
        className={`waypoint-item ${selectedWaypoint === actualWaypointId ? 'selected' : ''}`}
        onClick={(e) => {
    
        
        const newValue = selectedWaypoint === actualWaypointId ? null : actualWaypointId;
        
        onSelectedWaypointChange(newValue);
      }}
      >
        <div className="waypoint-item-header">
          <span className="waypoint-name">
            Waypoint {displayIndex} 
          </span>
          <div className="waypoint-status">
            <span className="journey-count">{waypointJourneys.length} journeys</span>
            {hasRouting && <span className="routing-indicator">●</span>}
          </div>
        </div>
        
        {selectedWaypoint === actualWaypointId && (
  <div 
    className="waypoint-details"// Use onMouseDown instead of onClick
  >
    {waypointJourneys.length === 0 ? (
      <div>
        <p className="no-journeys">No journeys pass through this waypoint</p>
        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          Full Waypoint ID: {actualWaypointId}
        </p>
      </div>
    ) : (
      waypointJourneys.map(journey => {
  const journeyKey = `${actualWaypointId}-${journey.id}`;
  const isExpanded = expandedJourneys.has(journeyKey);
  
  return (
    <div key={journey.id} className="journey-routing">
      <div 
        className="journey-header clickable"
        onClick={(e) => {
          e.stopPropagation();
          toggleJourneyExpansion(actualWaypointId, journey.id);
        }}
      >
        <div className="journey-header-content">
          <span className="expand-indicator">{isExpanded ? '▼' : '▶'}</span>
          <h5>{journey.name}</h5>
          <span className="destinations-count">
            ({waypointRouting[actualWaypointId]?.[journey.id]?.destinations?.length || 0} routes)
          </span>
        </div>
        {/* {isExpanded && (
          <button
            className="add-destination-btn"
            onClick={(e) => {
              e.stopPropagation();
              addDestination(actualWaypointId, journey.id);
            }}
          >
            + Add Route
          </button>
        )} */}
      </div>
      
      {isExpanded && (
        <div className="journey-content">
          {waypointRouting[actualWaypointId]?.[journey.id]?.destinations?.map((destination, destIndex) => (
            <div key={`${destination.target}-${destIndex}`} className="destination-item">
              <select
                value={destination.target}
                onChange={(e) => {
                  e.stopPropagation();
                  updateDestinationTarget(actualWaypointId, journey.id, destination.target, e.target.value);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="destination-select"
              >
                {getPossibleDestinations(actualWaypointId).map(dest => (
                  <option key={dest.id} value={dest.id}>{dest.name}</option>
                ))}
              </select>
              
              <div className="percentage-input-group">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={destination.percentage}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateDestinationPercentage(actualWaypointId, journey.id, destination.target, parseFloat(e.target.value) || 0);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                  }}
                  className="percentage-input"
                />
                <span className="percentage-symbol">%</span>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeDestination(actualWaypointId, journey.id, destination.target);
                }}
                className="remove-destination-btn"
                title="Remove destination"
              >
                ×
              </button>
            </div>
          ))}
          
          {waypointRouting[actualWaypointId]?.[journey.id]?.destinations && (
            <div className={`percentage-total ${getTotalPercentage(actualWaypointId, journey.id) !== 100 ? 'invalid' : 'valid'}`}>
              Total: {getTotalPercentage(actualWaypointId, journey.id)}%
              {getTotalPercentage(actualWaypointId, journey.id) !== 100 && (
                <span className="percentage-warning"> (Must equal 100%)</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
})
    )}
  </div>
)}
      </div>
    );
  })}
</div>
      </div>
    </div>
  );
};
export default JourneyEditor;
