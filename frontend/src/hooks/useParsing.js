import { useCallback } from 'react';
import { GRID_SIZE } from '../utils/canvasUtils';

export const useParsing = ({ setElements, setJourneyConnections, setIsFileUpload, setWaypointRouting }) => {

  const findElementById = useCallback((id, elements) => {
    const exit = elements.exits.find(e => e.id === id);
    if (exit) return { type: 'exit', element: exit, elementIndex: elements.exits.indexOf(exit) };
    
    const dist = elements.distributions.find(e => e.id === id);
    if (dist) return { type: 'distribution', element: dist, elementIndex: elements.distributions.indexOf(dist) };
    
    const waypoint = elements.waypoints.find(e => e.id === id);
    if (waypoint) return { type: 'waypoint', element: waypoint, elementIndex: elements.waypoints.indexOf(waypoint) };
    
    const boundary = elements.boundaries.find(e => e.id === id);
    if (boundary) return { type: 'boundary', element: boundary, elementIndex: elements.boundaries.indexOf(boundary) };
    
    const obstacle = elements.obstacles.find(e => e.id === id);
    if (obstacle) return { type: 'obstacle', element: obstacle, elementIndex: elements.obstacles.indexOf(obstacle) };
    
    return null;
  }, []);

  const parseCoordinateString = (coordString) => {
    
    // Clean the coordinate string - remove parentheses and normalize
    const cleanedString = coordString
      .trim()
      .replace(/^\(+/, '')   // Remove leading parentheses
      .replace(/\)+$/, '')   // Remove trailing parentheses
      .replace(/^,+/, '')    // Remove leading commas
      .replace(/,+$/, '')    // Remove trailing commas
      .replace(/,+/g, ',')   // Replace multiple commas with single comma
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();
      
    
    if (!cleanedString) {
      console.error('❌ Empty coordinate string after cleaning');
      return [];
    }
    
    const coordinates = cleanedString.split(',');
    
    const points = coordinates
      .map((coord, index) => {
        const trimmed = coord.trim();
        
        if (!trimmed) {
          console.warn(`⚠️ Empty coordinate at index ${index}, skipping`);
          return null;
        }
        
        const parts = trimmed.split(/\s+/);
        
        if (parts.length < 2) {
          console.error(`❌ Invalid coordinate format at index ${index}: "${trimmed}"`);
          return null;
        }
        
        const [x, y] = parts.map(Number);
        
        if (!isFinite(x) || !isFinite(y)) {
          console.error(`❌ Invalid numbers at index ${index}:`, {
            original: trimmed,
            parts: parts,
            x: x,
            y: y
          });
          return null;
        }
        
        return { 
          x: x * GRID_SIZE, 
          y: -y * GRID_SIZE  
        };
      })
      .filter(point => point !== null); // Remove null entries
    
    
    // Remove duplicate last point if present
    if (points.length > 3 && 
        Math.abs(points[0].x - points[points.length - 1].x) < 0.1 && 
        Math.abs(points[0].y - points[points.length - 1].y) < 0.1) {
      points.pop();
    }
    
    return points;
  };

  const parsePolygonWithHoles = (polygonContent) => {
    
    if (polygonContent.includes('), (')) {
      
      const rings = [];
      let depth = 0;
      let currentRing = '';
      
      for (let i = 0; i < polygonContent.length; i++) {
        const char = polygonContent[i];
        
        if (char === '(') {
          if (depth === 0) {
            currentRing = '';
          } else {
            currentRing += char;
          }
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            if (currentRing.trim()) {
              const points = parseCoordinateString(currentRing.trim());
              if (points.length >= 3) {
                rings.push(points);
              }
            }
          } else {
            currentRing += char;
          }
        } else if (depth > 0) {
          currentRing += char;
        }
      }
      
      return {
        exterior: rings[0] || [],
        holes: rings.slice(1)
      };
    } else {
      
      
      const cleanContent = polygonContent.replace(/^\s*\(\s*|\s*\)\s*$/g, '');
      const points = parseCoordinateString(cleanContent);
      
      return {
        exterior: points,
        holes: []
      };
    }
  };

  const cleanCoordinateString = (coordString) => {
    return coordString
      .trim()
      .replace(/^\(+/, '')   // Remove leading parentheses
      .replace(/\)+$/, '')   // Remove trailing parentheses
      .replace(/^,+/, '')    // Remove leading commas
      .replace(/,+$/, '')    // Remove trailing commas
      .replace(/,+/g, ',')   // Replace multiple commas with single comma
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();
  };

  const parseSimplePolygon = (wktString) => {
    
    // Check if this polygon has holes by looking for multiple ring structures
    const hasHoles = wktString.includes('), (');
    
    if (hasHoles) {
      
      // Extract the content inside POLYGON(...)
      const match = wktString.match(/POLYGON\s*\(\s*(.+)\s*\)$/);
      if (!match) {
        console.error('❌ Could not extract POLYGON content');
        return null;
      }
      
      const content = match[1];
      
      // Parse using the polygon with holes logic
      const polygonData = parsePolygonWithHoles(content);
      
      if (!polygonData.exterior || polygonData.exterior.length < 3) {
        console.error('❌ Invalid exterior ring');
        return null;
      }
      
      // Return the structure that includes both exterior and holes
      return {
        points: polygonData.exterior,  // Keep your existing format
        holes: polygonData.holes || []  // Add holes for processing
      };
      
    } else {
      
      // Original simple polygon parsing with parentheses cleaning
      const match = wktString.match(/POLYGON\s*\(\s*\(\s*([^)]+)\s*\)\s*\)/);
      if (!match) {
        console.error('❌ Could not match simple polygon pattern');
        return null;
      }
      
      const coordString = match[1];
      const cleanedCoords = cleanCoordinateString(coordString);
      const points = parseCoordinateString(cleanedCoords);
      
      if (points.length < 3) {
        console.error('❌ Insufficient points for polygon:', points.length);
        return null;
      }
      
      return {
        points: points,
        holes: []
      };
    }
  };

  const parseSimpleWKT = (wktString, newElements) => {
  
    const match = wktString.match(/GEOMETRYCOLLECTION\s*\((.+)\)$/);
    if (!match) {
      console.error('Could not extract GEOMETRYCOLLECTION content');
      return;
    }
    
    const content = match[1];

    const polygonRegex = /POLYGON\s*\(\s*([^)]+(?:\([^)]*\))*[^)]*)\s*\)/g;
    let polygonMatch;
    let polygonIndex = 0;
    
    while ((polygonMatch = polygonRegex.exec(content)) !== null) {
      
      const polygon = parsePolygonWithHoles(polygonMatch[1]);
      if (polygon) {
        
        if (polygonIndex === 0) {
          const boundary = {
            id: `boundary_wkt_${Date.now()}_${polygonIndex}`,
            points: polygon.exterior,
            closed: true
          };
          newElements.boundaries.push(boundary);
          
          
          const currentPolygonIndex = polygonIndex; 
          polygon.holes.forEach((hole, holeIndex) => {
            const obstacle = {
              id: `obstacle_wkt_${Date.now()}_${currentPolygonIndex}_${holeIndex}`,
              points: hole
            };
            newElements.obstacles.push(obstacle);
          });
        } else {
          
          const obstacle = {
            id: `obstacle_wkt_${Date.now()}_${polygonIndex}`,
            points: polygon.exterior
          };
          newElements.obstacles.push(obstacle);
        }
      }
      polygonIndex++;
    }
  };

  const parsePolygonRings = (ringsString) => {
    const rings = [];
    let depth = 0;
    let currentRing = '';
    let i = 0;
    
    while (i < ringsString.length) {
      const char = ringsString[i];
      
      if (char === '(') {
        if (depth === 0) {
          currentRing = '';
        } else {
          currentRing += char;
        }
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          
          if (currentRing.trim()) {
            const points = parseCoordinateString(currentRing.trim());
            if (points.length >= 3) {
              rings.push(points);
            }
          }
          currentRing = '';
        } else {
          currentRing += char;
        }
      } else if (depth > 0) {
        currentRing += char;
      }
      
      i++;
    }
    
    return rings;
  };

  const extractPolygonsWithHolesFromCollection = (collectionString) => {
    const polygons = [];
    
    
    if (collectionString.includes('EMPTY')) {
      return polygons;
    }
    
    
    const polygonRegex = /POLYGON\s*\(\s*(.+)\s*\)/gi;
    let match;
    
    while ((match = polygonRegex.exec(collectionString)) !== null) {
      const ringsString = match[1];
      const rings = parsePolygonRings(ringsString);
      
      if (rings.length > 0) {
        const polygonData = {
          exterior: rings[0], 
          holes: rings.slice(1) 
        };
        polygons.push(polygonData);
      }
    }
    
    return polygons;
  };

  const parseMainGeometryCollection = (wktString) => {
  
    const startIndex = wktString.indexOf('GEOMETRYCOLLECTION');
    if (startIndex === -1) return [];
    
    let i = wktString.indexOf('(', startIndex) + 1;
    const collections = [];
    let depth = 0;
    let currentCollection = '';
    
    while (i < wktString.length) {
      const char = wktString[i];
      
      if (char === '(') {
        depth++;
        currentCollection += char;
      } else if (char === ')') {
        if (depth === 1) {
          
          if (currentCollection.trim()) {
            collections.push(currentCollection.trim());
            currentCollection = '';
          }
          depth--;
          
          
          while (i < wktString.length && wktString[i] !== ',') {
            if (wktString[i] === ')') break; 
            i++;
          }
          if (i < wktString.length && wktString[i] === ',') {
            i++; 
            
            while (i < wktString.length && /\s/.test(wktString[i])) {
              i++;
            }
            continue;
          }
        } else {
          depth--;
          currentCollection += char;
        }
      } else {
        currentCollection += char;
      }
      
      i++;
    }
    
    return collections;
  };

  const parseComplexWKT = (wktString, newElements) => {
    const mainCollections = parseMainGeometryCollection(wktString);
    
    
    if (mainCollections[0]) {
      const walkablePolygonsWithHoles = extractPolygonsWithHolesFromCollection(mainCollections[0]);
      
      walkablePolygonsWithHoles.forEach((polygonData, index) => {
        if (polygonData.exterior && polygonData.exterior.length >= 3) {
          const boundary = {
            id: `boundary_wkt_${Date.now()}_${index}`,
            points: polygonData.exterior,
            closed: true
          };
          newElements.boundaries.push(boundary);
          
          
          polygonData.holes.forEach((hole, holeIndex) => {
            const obstacle = {
              id: `obstacle_wkt_${Date.now()}_${index}_${holeIndex}`,
              points: hole
            };
            newElements.obstacles.push(obstacle);
          });
        }
      });
    }
  };

  const parseWKTForBoundariesAndObstacles = async (wktString, newElements) => {
    wktString = wktString.trim();
    try {
      
      if (wktString.startsWith('GEOMETRYCOLLECTION(POLYGON')) {
        parseSimpleWKT(wktString, newElements);
      } 
      
      else if (wktString.startsWith('GEOMETRYCOLLECTION') && wktString.includes('GEOMETRYCOLLECTION (')) {
        parseComplexWKT(wktString, newElements);
      }
      
      else if (wktString.startsWith('POLYGON')) {
        const polygon = parseSimplePolygon(wktString);
        if (polygon) {
          const boundary = {
            id: `boundary_wkt_${Date.now()}_0`,
            points: polygon.points,
            closed: true
          };
          newElements.boundaries.push(boundary);
          // Add holes as obstacles
          if (polygon.holes && polygon.holes.length > 0) {
            polygon.holes.forEach((hole, holeIndex) => {
              if (hole.length >= 3) {
                const obstacle = {
                  id: `obstacle_wkt_${Date.now()}_0_${holeIndex}`,
                  points: hole
                };
                newElements.obstacles.push(obstacle);
              }
            });
          }
        }
      }
      else {
        console.error('Unknown WKT format');
      }
      
    } catch (error) {
      console.error('Error parsing WKT:', error);
    }
  };

  const parseJSONForConfiguration = async (jsonData, newElements) => {
  
    if (jsonData.exits) {
      Object.entries(jsonData.exits).forEach(([id, exitData]) => {
        if (exitData.type === 'polygon' && exitData.coordinates) {
          const points = exitData.coordinates.map(coord => ({
            x: coord[0] * GRID_SIZE,
            y: -coord[1] * GRID_SIZE
          }));
          
          
          if (points.length > 3 && 
              Math.abs(points[0].x - points[points.length - 1].x) < 0.1 && 
              Math.abs(points[0].y - points[points.length - 1].y) < 0.1) {
            points.pop();
          }
          
          newElements.exits.push({
            id: id,
            points: points
          });
        }
      });
    }
  
    
    if (jsonData.distributions) {
      Object.entries(jsonData.distributions).forEach(([id, distData]) => {
        if (distData.type === 'polygon' && distData.coordinates) {
          const points = distData.coordinates.map(coord => ({
            x: coord[0] * GRID_SIZE,
            y: -coord[1] * GRID_SIZE
          }));
          
          
          if (points.length > 3 && 
              Math.abs(points[0].x - points[points.length - 1].x) < 0.1 && 
              Math.abs(points[0].y - points[points.length - 1].y) < 0.1) {
            points.pop();
          }
          
          const defaultParameters = { number: 10, radius: 0.2, v0: 1.3 };
          const distribution = {
            id: id,
            points: points,
            parameters: { ...defaultParameters, ...(distData.parameters || {}) }
          };
          
          newElements.distributions.push(distribution);
        }
      });
    }
  
    
    if (jsonData.waypoints) {
      Object.entries(jsonData.waypoints).forEach(([id, waypointData]) => {
        if (waypointData.type === 'circle' && waypointData.center && waypointData.radius) {
          newElements.waypoints.push({
            id: id,
            center: {
              x: waypointData.center[0] * GRID_SIZE,
              y: -waypointData.center[1] * GRID_SIZE
            },
            radius: waypointData.radius * GRID_SIZE
          });
        }
      });
    }
  };

  const parseCombinedFiles = useCallback(async (files) => {
    try {
      if (setWaypointRouting) {
      setWaypointRouting({});
    }
    
      let jsonData = null;
      let wktData = null;
      
      
      for (const file of files) {
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          const text = await file.text();
          jsonData = JSON.parse(text);
        } else if (file.type === 'text/plain' || file.name.endsWith('.wkt') || file.name.endsWith('.txt')) {
          wktData = await file.text();
        }
      }
      
      if (!jsonData || !wktData) {
        alert('Please select both a JSON file and a WKT file');
        return false;
      }
      
      const newElements = {
        boundaries: [],
        exits: [],
        distributions: [],
        waypoints: [],
        obstacles: [],
        openBoundaries: []
      };
  
      setIsFileUpload(true);
      await parseWKTForBoundariesAndObstacles(wktData, newElements);
      await parseJSONForConfiguration(jsonData, newElements);
      
      setElements(newElements);
      
const newJourneyConnections = [];
const journeyIdMapping = new Map(); // ADD this line

if (jsonData.transitions && Array.isArray(jsonData.transitions)) {
  // Group transitions by journey_id to reconstruct frontend journey structure
  const journeyGroups = new Map();
  
  jsonData.transitions.forEach(transition => {
    const journeyId = transition.journey_id;
    if (!journeyGroups.has(journeyId)) {
      journeyGroups.set(journeyId, []);
    }
    journeyGroups.get(journeyId).push(transition);
  });
  
  // Convert backend journey IDs to frontend journey IDs (J1, J2, etc.)
  let frontendJourneyIndex = 1;
  
  journeyGroups.forEach((transitions, backendJourneyId) => {
    const frontendJourneyId = `J${frontendJourneyIndex++}`;
    journeyIdMapping.set(backendJourneyId, frontendJourneyId); // ADD this line
    
    transitions.forEach(transition => {
      const fromElement = findElementById(transition.from, newElements);
      const toElement = findElementById(transition.to, newElements);
      
      if (fromElement && toElement) {
        newJourneyConnections.push({
          from: fromElement,
          to: toElement,
          id: `connection_${frontendJourneyId}_${Date.now()}_${Math.random()}`,
          journeyId: frontendJourneyId,
          fromId: transition.from,
          toId: transition.to
        });
      }
    });
  });
}

if (newJourneyConnections.length > 0) {
  setJourneyConnections(newJourneyConnections);
}

      if (jsonData.waypoint_routing && setWaypointRouting) {
  const parsedWaypointRouting = {};
  
  Object.entries(jsonData.waypoint_routing).forEach(([backendWaypointId, journeyRouting]) => {
    // Find the frontend waypoint ID
    const waypoint = newElements.waypoints.find(w => w.id === backendWaypointId);
    if (waypoint) {
      parsedWaypointRouting[waypoint.id] = {};
      
      // Convert journey routing back to frontend format
      Object.entries(journeyRouting).forEach(([backendJourneyId, routingConfig]) => {
        // Find the corresponding frontend journey ID from journeyIdMapping
        const frontendJourneyId = journeyIdMapping.get(backendJourneyId);
        if (frontendJourneyId) {
          parsedWaypointRouting[waypoint.id][frontendJourneyId] = routingConfig;
        }
      });
    }
  });
  
  if (Object.keys(parsedWaypointRouting).length > 0) {
    setWaypointRouting(parsedWaypointRouting);
  }
}

      return true;
    } catch (error) {
      console.error('Error parsing files:', error);
      setIsFileUpload(false); 
      return false;
    }
  }, [setElements, setJourneyConnections, setIsFileUpload, findElementById]);

  const parseCombinedData = useCallback(async (jsonData, wktData) => {
    try {
      const newElements = {
        boundaries: [],
        exits: [],
        distributions: [],
        waypoints: [],
        obstacles: [],
        openBoundaries: []
      };
      
      // Use your existing parsing functions
      await parseWKTForBoundariesAndObstacles(wktData, newElements);
      await parseJSONForConfiguration(jsonData, newElements);
      
      setElements(newElements);
      
      const newJourneyConnections = [];
const journeyIdMapping = new Map(); // ADD this line

if (jsonData.transitions && Array.isArray(jsonData.transitions)) {
  // Group transitions by journey_id to reconstruct frontend journey structure
  const journeyGroups = new Map();
  
  jsonData.transitions.forEach(transition => {
    const journeyId = transition.journey_id;
    if (!journeyGroups.has(journeyId)) {
      journeyGroups.set(journeyId, []);
    }
    journeyGroups.get(journeyId).push(transition);
  });
  
  // Convert backend journey IDs to frontend journey IDs (J1, J2, etc.)
  let frontendJourneyIndex = 1;
  
  journeyGroups.forEach((transitions, backendJourneyId) => {
    const frontendJourneyId = `J${frontendJourneyIndex++}`;
    journeyIdMapping.set(backendJourneyId, frontendJourneyId); // ADD this line
    
    transitions.forEach(transition => {
      const fromElement = findElementById(transition.from, newElements);
      const toElement = findElementById(transition.to, newElements);
      
      if (fromElement && toElement) {
        newJourneyConnections.push({
          from: fromElement,
          to: toElement,
          id: `connection_${frontendJourneyId}_${Date.now()}_${Math.random()}`,
          journeyId: frontendJourneyId,
          fromId: transition.from,
          toId: transition.to
        });
      }
    });
  });
}

if (newJourneyConnections.length > 0) {
  setJourneyConnections(newJourneyConnections);
}

     if (jsonData.waypoint_routing && setWaypointRouting) {
  const parsedWaypointRouting = {};
  
  Object.entries(jsonData.waypoint_routing).forEach(([backendWaypointId, journeyRouting]) => {
    // Find the frontend waypoint ID
    const waypoint = newElements.waypoints.find(w => w.id === backendWaypointId);
    if (waypoint) {
      parsedWaypointRouting[waypoint.id] = {};
      
      // Convert journey routing back to frontend format
      Object.entries(journeyRouting).forEach(([backendJourneyId, routingConfig]) => {
        // Find the corresponding frontend journey ID from journeyIdMapping
        const frontendJourneyId = journeyIdMapping.get(backendJourneyId);
        if (frontendJourneyId) {
          parsedWaypointRouting[waypoint.id][frontendJourneyId] = routingConfig;
        }
      });
    }
  });
  
  if (Object.keys(parsedWaypointRouting).length > 0) {
    setWaypointRouting(parsedWaypointRouting);
  }
}
      return true;
    } catch (error) {
      console.error('Error parsing DXF data:', error);
      setIsFileUpload(false);
      return false;
    }
  }, [setElements, setJourneyConnections, setIsFileUpload, findElementById]);

  return { parseCombinedFiles, parseCombinedData, findElementById };
};
