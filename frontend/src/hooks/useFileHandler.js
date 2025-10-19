import { useCallback } from 'react';
import { useParsing } from './useParsing';
import { isPointInPolygon } from '../utils/canvasUtils';

export const useFileHandler = ({ 
  elements, 
  journeyConnections, 
  setError, 
  setIsFileUpload,
  SCALE_FACTOR,
  GRID_SIZE,
  setElements,
  setJourneyConnections,
  setWaypointRouting
}) => {
  const { parseCombinedFiles, parseCombinedData } = useParsing({
    setElements,
    setJourneyConnections,
    setIsFileUpload,
    setWaypointRouting
  });

  const validateElements = useCallback(() => {
    const errors = [];
    
    if (elements.boundaries.length === 0) {
      errors.push('At least one boundary is required');
      return errors;
    }
      
    // Helper function to check if point is in walkable area
    const isInWalkableArea = (point) => {
      return elements.boundaries.some(boundary => 
        boundary.closed && boundary.points.length >= 3 && 
        isPointInPolygon(point, boundary.points)
      );
    };
    
    // Validate starting areas (distributions)
    elements.distributions.forEach((distribution, index) => {
      const allPointsInside = distribution.points.every(point => isInWalkableArea(point));
      if (!allPointsInside) {
        errors.push(`Starting area ${index + 1} extends outside the walkable boundary`);
      }
      elements.distributions.forEach((otherDistribution, otherIndex) => {
          if (otherIndex <= index) return;
          
          const hasOverlap = distribution.points.some(point => 
            isPointInPolygon(point, otherDistribution.points)
          ) || otherDistribution.points.some(point => 
            isPointInPolygon(point, distribution.points)
          );
          
          if (hasOverlap) {
            errors.push(`Distributions ${index + 1} and ${otherIndex + 1} overlap`);
          }
        });
    });

    // Validate exits
    elements.exits.forEach((exit, index) => {
      const allPointsInside = exit.points.every(point => isInWalkableArea(point));
      if (!allPointsInside) {
        errors.push(`Exit ${index + 1} extends outside the walkable boundary`);
      }
      elements.exits.forEach((otherExit, otherIndex) => {
        if (otherIndex <= index) return;
        
        const hasOverlap = exit.points.some(point => 
          isPointInPolygon(point, otherExit.points)
        ) || otherExit.points.some(point => 
          isPointInPolygon(point, exit.points)
        );
        
        if (hasOverlap) {
          errors.push(`Exits ${index + 1} and ${otherIndex + 1} overlap`);
        }
      });
    });
    
    // Validate waypoints
    elements.waypoints.forEach((waypoint, index) => {
      if (!isInWalkableArea(waypoint.center)) {
        errors.push(`Waypoint ${index + 1} is outside the walkable boundary`);
      }
    });
    
    // Validate journey connections (if they exist)
    if (journeyConnections && journeyConnections.length > 0) {
      journeyConnections.forEach((connection, index) => {
        const fromElement = connection.from.element;
        const toElement = connection.to.element;
        
        // Check if connected elements are in walkable area
        if (fromElement.center && !isInWalkableArea(fromElement.center)) {
          errors.push(`Journey connection ${index + 1}: source element is outside walkable area`);
        }
        if (toElement.center && !isInWalkableArea(toElement.center)) {
          errors.push(`Journey connection ${index + 1}: target element is outside walkable area`);
        }
      });
    }
    
    // Validate obstacles
    if (elements.obstacles && elements.obstacles.length > 0) {
      elements.obstacles.forEach((obstacle, obstacleIndex) => {
        const allPointsInside = obstacle.points.every(point => isInWalkableArea(point));
        if (!allPointsInside) {
          errors.push(`Obstacle ${obstacleIndex + 1} extends outside the walkable boundary`);
        }
        
        const area = Math.abs(obstacle.points.reduce((acc, point, i) => {
          const nextPoint = obstacle.points[(i + 1) % obstacle.points.length];
          return acc + (point.x * nextPoint.y - nextPoint.x * point.y);
        }, 0)) / 2;
        
        // if (area < 10) {
        //   errors.push(`Obstacle ${obstacleIndex + 1} is too small (minimum area required)`);
        // }
        
        // Check obstacle-obstacle overlaps only
        elements.obstacles.forEach((otherObstacle, otherIndex) => {
          if (otherIndex <= obstacleIndex) return;
          
          const hasOverlap = obstacle.points.some(point => 
            isPointInPolygon(point, otherObstacle.points)
          ) || otherObstacle.points.some(point => 
            isPointInPolygon(point, obstacle.points)
          );
          
          if (hasOverlap) {
            errors.push(`Obstacles ${obstacleIndex + 1} and ${otherIndex + 1} overlap`);
          }
        });
      });
    }
    
    return errors;
  }, [elements, journeyConnections]);

  const calculateBounds = useCallback(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    [...elements.boundaries, ...elements.exits, ...elements.distributions, ...(elements.obstacles || [])].forEach(element => {
      element.points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
    });
    
    elements.waypoints.forEach(waypoint => {
      minX = Math.min(minX, waypoint.center.x - waypoint.radius);
      maxX = Math.max(maxX, waypoint.center.x + waypoint.radius);
      minY = Math.min(minY, waypoint.center.y - waypoint.radius);
      maxY = Math.max(maxY, waypoint.center.y + waypoint.radius);
    });
    
    return { minX, maxX, minY, maxY };
  }, [elements]);

  const transformToSaveCoordinates = useCallback((element, bounds) => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  if (element.points) {
    return {
      ...element,
      points: element.points.map(point => ({
        x: (point.x - centerX) / GRID_SIZE,
        y: -(point.y - centerY) / GRID_SIZE  // REMOVED: No Y flip needed
      }))
    };
  } else if (element.center) {
    return {
      ...element,
      center: {
        x: (element.center.x - centerX) / GRID_SIZE,
        y: -(element.center.y - centerY) / GRID_SIZE  // REMOVED: No Y flip needed
      },
      radius: element.radius / GRID_SIZE
    };
  }
  
  return element;
}, [GRID_SIZE]);

const transformToSimulationCoordinates = useCallback((element, bounds) => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  if (element.points) {
    return {
      ...element,
      points: element.points.map(point => ({
        x: (point.x - centerX) * SCALE_FACTOR,
        y: -(point.y - centerY) * SCALE_FACTOR  // REMOVED: No negative sign needed
      }))
    };
  } else if (element.center) {
    return {
      ...element,
      center: {
        x: (element.center.x - centerX) * SCALE_FACTOR,
        y: -(element.center.y - centerY) * SCALE_FACTOR  // REMOVED: No negative sign needed
      },
      radius: element.radius * SCALE_FACTOR
    };
  }
  
  return element;
}, [SCALE_FACTOR]);

// ADD this helper function before the waypoint routing section:
const convertTargetId = (frontendTargetId) => {
  // Check if it's an exit
  const exitIndex = elements.exits.findIndex(e => e.id === frontendTargetId);
  if (exitIndex >= 0) {
    return `jps-exits_${exitIndex}`;
  }
  
  // Check if it's a waypoint
  const waypointIndex = elements.waypoints.findIndex(w => w.id === frontendTargetId);
  if (waypointIndex >= 0) {
    return `jps-waypoints_${waypointIndex}`;
  }
  
  // Check if it's a distribution
  const distIndex = elements.distributions.findIndex(d => d.id === frontendTargetId);
  if (distIndex >= 0) {
    return `jps-distributions_${distIndex}`;
  }
  
  // SAFETY CHECK: Log invalid IDs
  console.error('⚠️ Invalid target ID in routing:', frontendTargetId);
  
  return null; // Return null for invalid IDs instead of the original ID
};
  const generateConfigFromDrawing = useCallback((waypointRouting = {}) => {
    if (elements.boundaries.length === 0) {
      setError('Please draw at least one boundary before running simulation.');
      return { json: null, wkt: null };
    }

    const unconfiguredDistributions = elements.distributions.filter(
      dist => !dist.parameters || !dist.parameters.number || dist.parameters.number <= 0
    );
    
    if (unconfiguredDistributions.length > 0) {
      setError(`Please configure agent counts for all starting areas. ${unconfiguredDistributions.length} area(s) need configuration.`);
      return { json: null, wkt: null };
    }

    const validationErrors = validateElements();
    if (validationErrors.length > 0) {
      alert(`Cannot run simulation due to validation errors:\n\n${validationErrors.join('\n')}`);
      setError(`Cannot run simulation due to validation errors:\n\n${validationErrors.join('\n')}`);
      return { json: null, wkt: null };
    }

    const bounds = calculateBounds();
    
    const generateWKT = () => {
      if (elements.boundaries.length === 0) return '';
      
      const mainBoundary = transformToSimulationCoordinates(elements.boundaries[0], bounds);
      
      const mainPoints = [...mainBoundary.points];
      const firstPoint = mainPoints[0];
      const lastPoint = mainPoints[mainPoints.length - 1];
      
      if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
        mainPoints.push(firstPoint);
      }
      
      const exteriorRing = mainPoints.map(p => `${p.x} ${p.y}`).join(', ');
      
      const interiorRings = [];
      if (elements.obstacles && elements.obstacles.length > 0) {
        elements.obstacles.forEach(obstacle => {
          const transformedObstacle = transformToSimulationCoordinates(obstacle, bounds);
          
          const obstaclePoints = [...transformedObstacle.points];
          const firstObstaclePoint = obstaclePoints[0];
          const lastObstaclePoint = obstaclePoints[obstaclePoints.length - 1];
          
          if (firstObstaclePoint.x !== lastObstaclePoint.x || firstObstaclePoint.y !== lastObstaclePoint.y) {
            obstaclePoints.push(firstObstaclePoint);
          }
          
          obstaclePoints.reverse();
          
          const interiorRing = obstaclePoints.map(p => `${p.x} ${p.y}`).join(', ');
          interiorRings.push(`(${interiorRing})`);
        });
      }
      
      if (interiorRings.length > 0) {
        return `POLYGON((${exteriorRing}), ${interiorRings.join(', ')})`;
      } else {
        return `POLYGON((${exteriorRing}))`;
      }
    };

    const generateJSON = () => {
      const config = {
        exits: {},
        distributions: {},
        waypoints: {},
        journeys: [],
        transitions: []
      };

      elements.exits.forEach((exit, index) => {
        const exitId = `jps-exits_${index}`;
        const transformedExit = transformToSimulationCoordinates(exit, bounds);
        
        const points = [...transformedExit.points];
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
          points.push(firstPoint);
        }
        
        config.exits[exitId] = {
          type: "polygon",
          coordinates: points.map(p => [p.x, p.y])
        };
      });

      elements.distributions.forEach((dist, index) => {
        const distId = `jps-distributions_${index}`;
        const transformedDist = transformToSimulationCoordinates(dist, bounds);
        
        const points = [...transformedDist.points];
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
          points.push(firstPoint);
        }
        
        config.distributions[distId] = {
          type: "polygon",
          coordinates: points.map(p => [p.x, p.y]),
          parameters: { 
            number: dist.parameters?.number || 10,
            radius: dist.parameters?.radius || 0.3,
            v0: dist.parameters?.v0 || 1.3,
            use_flow_spawning: dist.parameters?.use_flow_spawning || false,
            flow_start_time: dist.parameters?.flow_start_time || 0,
            flow_end_time: dist.parameters?.flow_end_time || 10
          }
        };
      });

      elements.waypoints.forEach((waypoint, index) => {
        const waypointId = `jps-waypoints_${index}`;
        const transformedWaypoint = transformToSimulationCoordinates(waypoint, bounds);
        
        config.waypoints[waypointId] = {
          type: "circle",
          center: [transformedWaypoint.center.x, transformedWaypoint.center.y],
          radius: transformedWaypoint.radius
        };
      });

      if (journeyConnections.length > 0) {
  // Group connections by journey ID
  const journeyGroups = new Map();
  
  journeyConnections.forEach(connection => {
    const journeyId = connection.journeyId || 'J1';
    if (!journeyGroups.has(journeyId)) {
      journeyGroups.set(journeyId, []);
    }
    journeyGroups.get(journeyId).push(connection);
  });
  
  // Create journeys and transitions
  let journeyIndex = 0;
  journeyGroups.forEach((connections, frontendJourneyId) => {
    const journeyId = `journey_${journeyIndex++}`;
    
    // Create stages from connections
    // Create ordered stages from connections (distribution -> waypoints -> exits)
const allStages = new Set();
connections.forEach(connection => {
  const fromId = getElementId(connection.from);
  const toId = getElementId(connection.to);
  if (fromId) allStages.add(fromId);
  if (toId) allStages.add(toId);
});

// Order stages: distributions first, then waypoints, then exits
const orderedStages = [];
const stageArray = Array.from(allStages);

// Add distributions first
stageArray.filter(stage => stage.startsWith('jps-distributions_')).forEach(stage => orderedStages.push(stage));
// Add waypoints second  
stageArray.filter(stage => stage.startsWith('jps-waypoints_')).forEach(stage => orderedStages.push(stage));
// Add exits last
stageArray.filter(stage => stage.startsWith('jps-exits_')).forEach(stage => orderedStages.push(stage));

const journey = {
  id: journeyId,
  stages: orderedStages,
  transitions: []
};
    
    // Create transitions for this journey
    connections.forEach(connection => {
      const fromId = getElementId(connection.from);
      const toId = getElementId(connection.to);
      
      if (fromId && toId) {
        const transition = {
          from: fromId,
          to: toId,
          journey_id: journeyId
        };
        journey.transitions.push(transition);
        config.transitions.push(transition);
      }
    });
    
    config.journeys.push(journey);
  });
  if (waypointRouting && Object.keys(waypointRouting).length > 0) {
  config.waypoint_routing = {};
  
  // Convert frontend waypoint IDs and journey IDs to backend format
  Object.entries(waypointRouting).forEach(([frontendWaypointId, journeyRouting]) => {
    // Find the backend waypoint ID
    const waypointIndex = elements.waypoints.findIndex(w => w.id === frontendWaypointId);
    if (waypointIndex >= 0) {
      const backendWaypointId = `jps-waypoints_${waypointIndex}`;
      config.waypoint_routing[backendWaypointId] = {};
      
      // Convert journey routing
      Object.entries(journeyRouting).forEach(([frontendJourneyId, routingConfig]) => {
        // Find the corresponding backend journey ID
        const journeyIndex = Array.from(journeyGroups.keys()).indexOf(frontendJourneyId);
        if (journeyIndex >= 0) {
          const backendJourneyId = `journey_${journeyIndex}`;
          
          // FIXED: Convert destination target IDs to backend format
          const convertedRoutingConfig = {
            ...routingConfig,
            destinations: routingConfig.destinations?.map(dest => ({
              ...dest,
              target: convertTargetId(dest.target) // ADD this conversion function call
            })) || []
          };
          
          config.waypoint_routing[backendWaypointId][backendJourneyId] = convertedRoutingConfig;
        }
      });
    }
  });
}


}
      return config;
    };

    const getElementId = (elementData) => {
      const { type, element } = elementData;
      
      if (type === 'obstacle') return null;
      
      if (type === 'exit') {
        const index = elements.exits.findIndex(e => e.id === element.id);
        return index >= 0 ? `jps-exits_${index}` : null;
      } else if (type === 'distribution') {
        const index = elements.distributions.findIndex(d => d.id === element.id);
        return index >= 0 ? `jps-distributions_${index}` : null;
      } else if (type === 'waypoint') {
        const index = elements.waypoints.findIndex(w => w.id === element.id);
        return index >= 0 ? `jps-waypoints_${index}` : null;
      }
      
      return null;
    };
    
    try {
      const wkt = generateWKT();
      const jsonConfig = generateJSON();
      
      
      return {
        json: jsonConfig,
        wkt: wkt
      };
    } catch (error) {
      console.error('Error generating configuration:', error);
      setError('Error generating configuration. Please check your drawing and try again.');
      return { json: null, wkt: null };
    }
  }, [elements, journeyConnections, validateElements, calculateBounds, transformToSimulationCoordinates]);

  const generateConfigForSave = useCallback((waypointRouting = {}) => {
    if (elements.boundaries.length === 0) {
      setError('Please draw at least one boundary before running simulation.');
      return { json: null, wkt: null };
    }

    const unconfiguredDistributions = elements.distributions.filter(
      dist => !dist.parameters || !dist.parameters.number || dist.parameters.number <= 0
    );
    
    if (unconfiguredDistributions.length > 0) {
      setError(`Please configure agent counts for all starting areas. ${unconfiguredDistributions.length} area(s) need configuration.`);
      return { json: null, wkt: null };
    }

    const validationErrors = validateElements();
    if (validationErrors.length > 0) {
      alert(`Cannot run simulation due to validation errors:\n\n${validationErrors.join('\n')}`);
      setError(`Cannot run simulation due to validation errors:\n\n${validationErrors.join('\n')}`);
      return { json: null, wkt: null };
    }

    const bounds = calculateBounds();
    
    const generateWKT = () => {
      if (elements.boundaries.length === 0) return '';
      
      const mainBoundary = transformToSaveCoordinates(elements.boundaries[0], bounds);
      
      const mainPoints = [...mainBoundary.points];
      const firstPoint = mainPoints[0];
      const lastPoint = mainPoints[mainPoints.length - 1];
      
      if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
        mainPoints.push(firstPoint);
      }
      
      const exteriorRing = mainPoints.map(p => `${p.x} ${p.y}`).join(', ');
      
      const interiorRings = [];
      if (elements.obstacles && elements.obstacles.length > 0) {
        elements.obstacles.forEach(obstacle => {
          const transformedObstacle = transformToSaveCoordinates(obstacle, bounds);
          
          const obstaclePoints = [...transformedObstacle.points];
          const firstObstaclePoint = obstaclePoints[0];
          const lastObstaclePoint = obstaclePoints[obstaclePoints.length - 1];
          
          if (firstObstaclePoint.x !== lastObstaclePoint.x || firstObstaclePoint.y !== lastObstaclePoint.y) {
            obstaclePoints.push(firstObstaclePoint);
          }
          
          obstaclePoints.reverse();
          
          const interiorRing = obstaclePoints.map(p => `${p.x} ${p.y}`).join(', ');
          interiorRings.push(`(${interiorRing})`);
        });
      }
      
      if (interiorRings.length > 0) {
        return `POLYGON((${exteriorRing}), ${interiorRings.join(', ')})`;
      } else {
        return `POLYGON((${exteriorRing}))`;
      }
    };

    const generateJSON = () => {
      const config = {
        exits: {},
        distributions: {},
        waypoints: {},
        journeys: [],
        transitions: []
      };

      elements.exits.forEach((exit, index) => {
        const exitId = `jps-exits_${index}`;
        const transformedExit = transformToSaveCoordinates(exit, bounds);
        
        const points = [...transformedExit.points];
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
          points.push(firstPoint);
        }
        
        config.exits[exitId] = {
          type: "polygon",
          coordinates: points.map(p => [p.x, p.y])
        };
      });

      elements.distributions.forEach((dist, index) => {
        const distId = `jps-distributions_${index}`;
        const transformedDist = transformToSaveCoordinates(dist, bounds);
        
        const points = [...transformedDist.points];
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
          points.push(firstPoint);
        }
        
        config.distributions[distId] = {
          type: "polygon",
          coordinates: points.map(p => [p.x, p.y]),
          parameters: { 
            number: dist.parameters?.number || 10,
            radius: dist.parameters?.radius || 0.3,
            v0: dist.parameters?.v0 || 1.3
          }
        };
      });

      elements.waypoints.forEach((waypoint, index) => {
        const waypointId = `jps-waypoints_${index}`;
        const transformedWaypoint = transformToSaveCoordinates(waypoint, bounds);
        
        config.waypoints[waypointId] = {
          type: "circle",
          center: [transformedWaypoint.center.x, transformedWaypoint.center.y],
          radius: transformedWaypoint.radius
        };
      });

      if (journeyConnections.length > 0) {
  // Group connections by journey ID
  const journeyGroups = new Map();
  
  journeyConnections.forEach(connection => {
    const journeyId = connection.journeyId || 'J1';
    if (!journeyGroups.has(journeyId)) {
      journeyGroups.set(journeyId, []);
    }
    journeyGroups.get(journeyId).push(connection);
  });
  
  // Create journeys and transitions
  let journeyIndex = 0;
  journeyGroups.forEach((connections, frontendJourneyId) => {
    const journeyId = `journey_${journeyIndex++}`;
    
    // Create stages from connections
    // Create ordered stages from connections (distribution -> waypoints -> exits)
const allStages = new Set();
connections.forEach(connection => {
  const fromId = getElementId(connection.from);
  const toId = getElementId(connection.to);
  if (fromId) allStages.add(fromId);
  if (toId) allStages.add(toId);
});

// Order stages: distributions first, then waypoints, then exits
const orderedStages = [];
const stageArray = Array.from(allStages);

// Add distributions first
stageArray.filter(stage => stage.startsWith('jps-distributions_')).forEach(stage => orderedStages.push(stage));
// Add waypoints second  
stageArray.filter(stage => stage.startsWith('jps-waypoints_')).forEach(stage => orderedStages.push(stage));
// Add exits last
stageArray.filter(stage => stage.startsWith('jps-exits_')).forEach(stage => orderedStages.push(stage));

const journey = {
  id: journeyId,
  stages: orderedStages,
  transitions: []
};
    
    // Create transitions for this journey
    connections.forEach(connection => {
      const fromId = getElementId(connection.from);
      const toId = getElementId(connection.to);
      
      if (fromId && toId) {
        const transition = {
          from: fromId,
          to: toId,
          journey_id: journeyId
        };
        journey.transitions.push(transition);
        config.transitions.push(transition);
      }
    });
    
    config.journeys.push(journey);
  });
  if (waypointRouting && Object.keys(waypointRouting).length > 0) {
  config.waypoint_routing = {};
  
  // Convert frontend waypoint IDs and journey IDs to backend format
  Object.entries(waypointRouting).forEach(([frontendWaypointId, journeyRouting]) => {
    // Find the backend waypoint ID
    const waypointIndex = elements.waypoints.findIndex(w => w.id === frontendWaypointId);
    if (waypointIndex >= 0) {
      const backendWaypointId = `jps-waypoints_${waypointIndex}`;
      config.waypoint_routing[backendWaypointId] = {};
      
      // Convert journey routing
      Object.entries(journeyRouting).forEach(([frontendJourneyId, routingConfig]) => {
        // Find the corresponding backend journey ID
        const journeyIndex = Array.from(journeyGroups.keys()).indexOf(frontendJourneyId);
        if (journeyIndex >= 0) {
          const backendJourneyId = `journey_${journeyIndex}`;
          
          // FIXED: Convert destination target IDs to backend format
          const convertedRoutingConfig = {
            ...routingConfig,
            destinations: routingConfig.destinations?.map(dest => ({
              ...dest,
              target: convertTargetId(dest.target) // ADD this conversion function call
            })) || []
          };
          
          config.waypoint_routing[backendWaypointId][backendJourneyId] = convertedRoutingConfig;
        }
      });
    }
  });
}
}
      return config;
    };

    const getElementId = (elementData) => {
      const { type, element } = elementData;
      
      if (type === 'obstacle') return null;
      
      if (type === 'exit') {
        const index = elements.exits.findIndex(e => e.id === element.id);
        return index >= 0 ? `jps-exits_${index}` : null;
      } else if (type === 'distribution') {
        const index = elements.distributions.findIndex(d => d.id === element.id);
        return index >= 0 ? `jps-distributions_${index}` : null;
      } else if (type === 'waypoint') {
        const index = elements.waypoints.findIndex(w => w.id === element.id);
        return index >= 0 ? `jps-waypoints_${index}` : null;
      }
      
      return null;
    };

    try {
      const wkt = generateWKT();
      const jsonConfig = generateJSON();
      
      return {
        json: jsonConfig,
        wkt: wkt
      };
    } catch (error) {
      console.error('Error generating configuration:', error);
      setError('Error generating configuration. Please check your drawing and try again.');
      return { json: null, wkt: null };
    }
  }, [elements, journeyConnections, validateElements, calculateBounds, transformToSaveCoordinates]);

  const handleDxfUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      alert('Please select a DXF file');
      return;
    }
    
    try {
      setIsFileUpload(true);
      
      if (setWaypointRouting) {
      setWaypointRouting({});
    }
    
      const formData = new FormData();
      formData.append('file', file);
      const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
      const response = await fetch(`${fetchURL}/convert-dxf`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to convert DXF file');
      }
      
      const result = await response.json();
      
      if (result.success) {
        const success = await parseCombinedData(result.json, result.wkt);
              
        if (success) {
            const summaryDetails = [
            `Walkable areas: ${result.summary.walkable_areas}`,
            `Obstacles: ${result.summary.obstacles}`,
            `Exits: ${result.summary.exits}`,
            `Start areas: ${result.summary.distributions}`,
            `Waypoints: ${result.summary.waypoints}`,
            `Journeys: ${result.summary.journeys}`
          ].join('\n');
          
          const layersInfo = Object.entries(result.layers_detected)
            .filter(([_, layers]) => layers.length > 0)
            .map(([type, layers]) => `${type}: ${layers.join(', ')}`)
            .join('\n');
                  
          setTimeout(() => {
          }, 500);
        } else {
          throw new Error('Failed to process converted data');
        }
      } else {
        
        const formatErrorsForAlert = (errorResponse) => {
          if (!errorResponse.errors || errorResponse.errors.length === 0) {
            return 'Unknown conversion error occurred';
          }
          
          const errorMessages = errorResponse.errors.map((error, index) => {
            let userMessage = error.message;
            return userMessage;
          }).filter(msg => msg !== null);
          
          return errorMessages.join('\n\n');
        };
        
        const errorMessage = formatErrorsForAlert(result);
        const warningMessage = result.warnings && result.warnings.length > 0 
          ? `\n\n⚠️ Warnings:\n${result.warnings.map(w => w.message).join('\n')}` 
          : '';
        
        alert(
          `❌ DXF Conversion Failed (${result.filename})\n\n` +
          `${errorMessage}` +
          `${warningMessage}\n\n` 
        );
        
        setIsFileUpload(false);
      }
    } catch (error) {
  console.error('Error uploading DXF:', error);
  setIsFileUpload(false);
  
  
  // Handle different error types
  let errorMessage = 'Unknown error occurred';
  
  if (error.message) {
    if (typeof error.message === 'object') {
      // If the error message is an object, extract meaningful info
      console.log('Error message is object, keys:', Object.keys(error.message));
      errorMessage = JSON.stringify(error.message, null, 2);
    } else if (typeof error.message === 'string') {
      errorMessage = error.message.includes('DXF parsing error:') 
        ? error.message.replace('DXF parsing error: ', '')
        : error.message;
    }
  }
  
  console.log('Final processed error message:', errorMessage);
  console.log('Final processed error message type:', typeof errorMessage);
  
  alert(`❌ DXF Conversion Failed\n\n${errorMessage}\n\nPlease check:\n• File is a valid DXF format\n• Contains required layers (jps-walkablearea-* or walkablearea-*)\n• Layers are visible and not frozen\n• Geometries are properly closed`);
}
    
    event.target.value = '';
  }, [parseCombinedData, setIsFileUpload]);

  const handleDxfUploadClick = useCallback((dxfFileInputRef) => {
    dxfFileInputRef.current?.click();
  }, []);

  const handleCombinedUpload = useCallback((event) => {
    const files = Array.from(event.target.files);
    
    if (files.length !== 2) {
      alert('Please select exactly 2 files: one JSON and one WKT file');
      return;
    }
    
    const hasJson = files.some(file => file.type === 'application/json' || file.name.endsWith('.json'));
    const hasWkt = files.some(file => file.type === 'text/plain' || file.name.endsWith('.wkt') || file.name.endsWith('.txt'));
    
    if (!hasJson || !hasWkt) {
      alert('Please select one JSON file and one WKT file');
      return;
    }
    
    parseCombinedFiles(files);
    event.target.value = ''; 
  }, [parseCombinedFiles]);

  const handleCombinedUploadClick = useCallback((combinedFileInputRef) => {
    combinedFileInputRef.current?.click();
  }, []);

  const handleWktOnlyUpload = useCallback(async (wktFile) => {
  try {
    setIsFileUpload(true);
    
    if (setWaypointRouting) {
      setWaypointRouting({});
    }
    
    const wktContent = await wktFile.text();
    
    // Create a basic JSON configuration with empty elements
    const basicJson = {
      exits: {},
      distributions: {},
      waypoints: {},
      journeys: [],
      transitions: []
    };
    
    const success = await parseCombinedData(basicJson, wktContent);
    
    if(!success){
      throw new Error('Failed to process WKT file');
    }
  } catch (error) {
    console.error('Error uploading WKT:', error);
    setIsFileUpload(false);
    alert(`❌ WKT Upload Failed\n\n${error.message}\n\nPlease check that the file contains valid WKT geometry data.`);
  }
}, [parseCombinedData, setIsFileUpload, setWaypointRouting]);

  const handleSaveJsonAndWkt = useCallback((waypointRouting = {}) => {
    const { json, wkt } = generateConfigForSave(waypointRouting);

    if (!json || !wkt) {
      alert("Could not generate files. Make sure you have at least one boundary and configured starting areas.");
      return;
    }

    const downloadFile = (content, fileName, contentType) => {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    downloadFile(JSON.stringify(json, null, 2), 'config.json', 'application/json');
    downloadFile(wkt, 'geometry.wkt', 'text/plain');
  }, [generateConfigForSave]);

  const handleProjectUpload = useCallback(async (event) => {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  // Reset the file input
  event.target.value = '';

  // Check what type of files we have
  const dxfFiles = files.filter(file => file.name.toLowerCase().endsWith('.dxf'));
  const jsonFiles = files.filter(file => 
    file.name.toLowerCase().endsWith('.json') || file.type === 'application/json'
  );
  const wktFiles = files.filter(file => 
    file.name.toLowerCase().endsWith('.wkt') || 
    file.name.toLowerCase().endsWith('.txt') ||
    file.type === 'text/plain'
  );

  // Handle different scenarios
  if (dxfFiles.length > 0) {
    // DXF file detected - use DXF parser
    if (dxfFiles.length > 1) {
      setError('Please select only one DXF file at a time.');
      alert('Please select only one DXF file at a time.');
      return;
    }
    
    console.log('📐 DXF file detected, using DXF parser...');
    // Create a mock event for the existing DXF handler
    const mockEvent = {
      target: {
        files: dxfFiles,
        value: ''
      }
    };
    await handleDxfUpload(mockEvent);
    
  } else if (jsonFiles.length > 0 && wktFiles.length > 0) {
    // JSON + WKT files detected - use combined parser
    console.log('📄 JSON + WKT files detected, using combined parser...');
    const combinedFiles = [...jsonFiles, ...wktFiles];
    
    // Create a mock event for the existing combined handler
    const mockEvent = {
      target: {
        files: combinedFiles,
        value: ''
      }
    };
    await handleCombinedUpload(mockEvent);
    
  } else if (wktFiles.length > 0 && jsonFiles.length === 0) {
    // WKT only - create basic configuration
    console.log('📄 WKT file detected, creating basic configuration...');
    await handleWktOnlyUpload(wktFiles[0]);
    
  } else if (jsonFiles.length > 0 && wktFiles.length === 0) {
    // Only JSON - not supported
    alert('JSON files alone are not supported. Please select either:\n• A DXF file\n• A WKT file\n• Both JSON and WKT files');
    
  } else if (jsonFiles.length > 0) {
    // JSON detected - not allowed
    alert('JSON files alone are not supported. Please select either:\n• A DXF file\n• A WKT file\n• Both JSON and WKT files');

  } else {
    // No recognized files
    alert('Please select either a DXF file, a WKT file, or both JSON and WKT files.');
  }
}, [handleDxfUpload, handleCombinedUpload, setError]);

const handleProjectUploadClick = useCallback((projectFileInputRef) => {
  if (projectFileInputRef.current) {
    projectFileInputRef.current.click();
  }
}, []);

const handleProjectDownload = useCallback((waypointRouting = {}) => {
  // This is just a renamed version of handleSaveJsonAndWkt
  handleSaveJsonAndWkt(waypointRouting);
}, [handleSaveJsonAndWkt]);
  return {
    handleDxfUpload,
    handleDxfUploadClick,
    handleCombinedUpload,
    handleCombinedUploadClick,
    generateConfigFromDrawing,
    generateConfigForSave,
    handleSaveJsonAndWkt,
    parseCombinedFiles,
    parseCombinedData,
    validateElements,
    calculateBounds,
    handleProjectUpload,
    handleProjectUploadClick,
    handleProjectDownload
  };
};
