import React, { useState } from 'react';
import '../../styles/scenario-upload.css';

const ScenarioSaveModal = ({ isOpen, onClose, currentScenario = null, elements, journeyConnections, generateConfigFromDrawing, waypointRouting = {} }) => {
  const [formData, setFormData] = useState({
    name: currentScenario?.name || '',
    description: currentScenario?.description || '',
    author: currentScenario?.metadata?.author || '',
    category: currentScenario?.metadata?.category || ''
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = process.env.REACT_APP_MONGODB_URI || 'http://localhost:3001/api';

  const resetForm = () => {
    if (currentScenario) {
      setFormData({
        name: currentScenario.name,
        description: currentScenario.description,
        author: currentScenario.metadata.author,
        category: currentScenario.metadata.category
      });
    } else {
      setFormData({
        name: '',
        description: '',
        author: '',
        category: ''
      });
    }
    setThumbnailFile(null);
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setThumbnailFile(e.target.files[0]);
  };

  // Generate configuration from current drawing using your existing logic
  const generateConfigFromCurrentDrawing = () => {
    // This mirrors your generateConfigFromDrawing function
    if (elements.boundaries.length === 0) {
      throw new Error('Please draw at least one boundary before saving.');
    }

    const unconfiguredDistributions = elements.distributions.filter(
      dist => !dist.parameters || !dist.parameters.number || dist.parameters.number <= 0
    );
    
    if (unconfiguredDistributions.length > 0) {
      throw new Error(`Please configure agent counts for all starting areas. ${unconfiguredDistributions.length} area(s) need configuration.`);
    }

    // Calculate bounds
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

    const bounds = { minX, maxX, minY, maxY };
    
    // Validate bounds
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY) ||
        minX === maxX || minY === maxY) {
      console.error('Invalid bounds calculated:', bounds);
      throw new Error('Invalid geometry bounds - please check your drawing');
    }
    const SCALE_FACTOR = 0.1;

    // Transform coordinates with validation
    const transformToSimulationCoordinates = (element, bounds) => {
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      
      // Validate bounds
      if (!isFinite(centerX) || !isFinite(centerY)) {
        console.error('Invalid bounds for transformation:', bounds);
        throw new Error('Invalid geometry bounds - cannot transform coordinates');
      }
      
      if (element.points) {
        return {
          ...element,
          points: element.points.map(point => {
            const transformedX = (point.x - centerX) * SCALE_FACTOR;
            const transformedY = (point.y - centerY) * SCALE_FACTOR;
            
            // Validate transformed coordinates
            if (!isFinite(transformedX) || !isFinite(transformedY)) {
              console.error('Invalid point transformation:', point, 'bounds:', bounds);
              throw new Error('Invalid coordinate transformation detected');
            }
            
            return {
              x: transformedX,
              y: transformedY
            };
          })
        };
      } else if (element.center) {
        const transformedX = (element.center.x - centerX) * SCALE_FACTOR;
        const transformedY = (element.center.y - centerY) * SCALE_FACTOR;
        const transformedRadius = element.radius * SCALE_FACTOR;
        
        // Validate transformed coordinates
        if (!isFinite(transformedX) || !isFinite(transformedY) || !isFinite(transformedRadius)) {
          console.error('Invalid waypoint transformation:', element, 'bounds:', bounds);
          throw new Error('Invalid waypoint coordinate transformation detected');
        }
        
        return {
          ...element,
          center: {
            x: transformedX,
            y: transformedY
          },
          radius: transformedRadius
        };
      }
      
      return element;
    };

    // Generate WKT
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

    // Generate JSON
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
            v0: dist.parameters?.v0 || 1.3
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

      // Handle journey connections
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
    const stages = new Set();
    connections.forEach(connection => {
      const fromId = getElementId(connection.from);
      const toId = getElementId(connection.to);
      if (fromId) stages.add(fromId);
      if (toId) stages.add(toId);
    });
    
    const journey = {
      id: journeyId,
      stages: Array.from(stages),
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

  // ADD waypoint routing conversion
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

  // Add waypoint routing if it exists
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
            
            // Convert destination target IDs to backend format
            const convertedRoutingConfig = {
              ...routingConfig,
              destinations: routingConfig.destinations?.map(dest => ({
                ...dest,
                target: convertTargetId(dest.target)
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

    return {
      json: generateJSON(),
      wkt: generateWKT()
    };
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Scenario name is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Use the existing working generateConfigFromDrawing function
      const config = generateConfigFromDrawing(waypointRouting);
      // const config = generateConfigFromDrawing();
      if (!config.json || !config.wkt) {
        setError('Failed to generate valid configuration from current drawing');
        return;
      }
      
      const submitFormData = new FormData();
      
      // Add text fields
      Object.keys(formData).forEach(key => {
        submitFormData.append(key, formData[key]);
      });
      
      // Create JSON and WKT files as blobs
      const jsonBlob = new Blob([JSON.stringify(config.json, null, 2)], { type: 'application/json' });
      const wktBlob = new Blob([config.wkt], { type: 'text/plain' });
      
      submitFormData.append('jsonFile', jsonBlob, 'config.json');
      submitFormData.append('wktFile', wktBlob, 'geometry.wkt');
      
      if (thumbnailFile) {
        submitFormData.append('thumbnail', thumbnailFile);
      }
      
      const url = `${API_BASE}/scenarios`;
        
      const method =  'POST';
      
      const response = await fetch(url, {
        method,
        body: submitFormData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        resetForm();
        onClose();
      } else {
        setError(data.error || `Failed to 'save'} scenario`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save scenario');
      console.error(`Error saving scenario:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="scenario-upload-modal">
        <div className="modal-header">
          <h2>{'Save Current Scenario'}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-section">
            <h3>Scenario Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Scenario Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter scenario name"
                maxLength="100"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your scenario... (optional)"
                maxLength="500"
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="author">Author</label>
              <input
                type="text"
                id="author"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                placeholder="Your name (optional)"
                maxLength="50"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Classification</h3>
            
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="e.g., evacuation, crowd-flow, bottleneck..."
                maxLength="50"
              />
            </div>
            
           
          </div>

          <div className="form-section">
            <h3>Thumbnail</h3>
            
            <div className="form-group">
              <label htmlFor="thumbnail">
                {'Thumbnail Image (optional)'}
              </label>
              <input
                type="file"
                id="thumbnail"
                name="thumbnail"
                accept="image/*"
                onChange={handleFileChange}
              />
              <small>Upload a preview image for your scenario (max 5MB)</small>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  {'Saving...'}
                </>
              ) : (
                'Save Scenario'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScenarioSaveModal;