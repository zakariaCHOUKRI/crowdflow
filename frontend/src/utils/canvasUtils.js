

export const GRID_SIZE = 20; 
export const SNAP_RADIUS = 10;
export const SCALE_FACTOR = 0.1;
export const DISPLAY_SCALE = 20;

// Add these functions to canvasUtils.js

export const GRID_SNAP_THRESHOLD = 15; // pixels
export const ANGLE_SNAP_THRESHOLD = 5; // degrees

export const snapToGrid = (worldPoint, zoom) => {
  // Only snap when zoomed in enough to see grid clearly
  if (zoom < 0.5) return worldPoint;
  
  const snapRadius = GRID_SNAP_THRESHOLD / zoom; // Convert to world coordinates
  
  // Round to nearest grid point
  const snappedX = Math.round(worldPoint.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(worldPoint.y / GRID_SIZE) * GRID_SIZE;
  
  // Check if we're close enough to snap
  const distanceX = Math.abs(worldPoint.x - snappedX);
  const distanceY = Math.abs(worldPoint.y - snappedY);
  
  return {
    x: distanceX < snapRadius ? snappedX : worldPoint.x,
    y: distanceY < snapRadius ? snappedY : worldPoint.y,
    snapped: distanceX < snapRadius || distanceY < snapRadius
  };
};

export const snapToAngle = (fromPoint, toPoint, zoom) => {
  if (zoom < 0.5) return { point: toPoint, snapped: false };
  
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 1) return { point: toPoint, snapped: false };
  
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Check for horizontal (0°, 180°) and vertical (90°, 270°) lines
  const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  
  for (const snapAngle of snapAngles) {
    const angleDiff = Math.abs(((angle - snapAngle + 180) % 360) - 180);
    
    if (angleDiff <= ANGLE_SNAP_THRESHOLD) {
      const radians = snapAngle * (Math.PI / 180);
      const snappedX = fromPoint.x + distance * Math.cos(radians);
      const snappedY = fromPoint.y + distance * Math.sin(radians);
      
      return {
        point: { x: snappedX, y: snappedY },
        snapped: true,
        snapAngle: snapAngle,
        snapType: snapAngle % 90 === 0 ? (snapAngle % 180 === 0 ? 'horizontal' : 'vertical') : 'diagonal'
      };
    }
  }
  
  return { point: toPoint, snapped: false };
};

export const getGridSnapIndicator = (worldPoint, zoom) => {
  if (zoom < 0.5) return null;
  
  const snappedX = Math.round(worldPoint.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(worldPoint.y / GRID_SIZE) * GRID_SIZE;
  
  return { x: snappedX, y: snappedY };
};

export const createCoordinateConverters = (viewOffset, zoom) => {
  const screenToWorld = (screenX, screenY) => {
    const x = (screenX - viewOffset.x) / zoom;
    const y = (screenY - viewOffset.y) / zoom;
    return { x, y };
  };

  const worldToScreen = (worldX, worldY) => {
    const x = worldX * zoom + viewOffset.x;
    const y = worldY * zoom + viewOffset.y;
    return { x, y };
  };

  return { screenToWorld, worldToScreen };
};


export const getScaleInfo = (zoom) => {
  const pixelsPerMeter = zoom * GRID_SIZE;
  let realDistanceInMeters = 100 / pixelsPerMeter;
  
  const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(realDistanceInMeters)));
  const normalizedDistance = realDistanceInMeters / orderOfMagnitude;
  
  let niceDistance;
  if (normalizedDistance <= 1) niceDistance = 1;
  else if (normalizedDistance <= 2) niceDistance = 2;
  else if (normalizedDistance <= 5) niceDistance = 5;
  else niceDistance = 10;
  
  realDistanceInMeters = niceDistance * orderOfMagnitude;
  const scaleLengthInPixels = realDistanceInMeters * pixelsPerMeter;
  
  return { scaleLength: scaleLengthInPixels, realDistance: realDistanceInMeters };
};




export const findVertexAtPoint = (worldPoint, elements, zoom, activeBoundary = []) => {
  const clickRadius = Math.max(3, 6 / zoom); 
  
  
  for (let i = 0; i < activeBoundary.length; i++) {
    const point = activeBoundary[i];
    const distance = Math.sqrt(
      Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
    );
    if (distance <= clickRadius) {
      return { 
        type: 'activeBoundary', 
        pointIndex: i, 
        point: point,
        distance: distance 
      };
    }
  }
  
  
  if (elements.openBoundaries) {
    for (let i = 0; i < elements.openBoundaries.length; i++) {
      const openBoundary = elements.openBoundaries[i];
      for (let j = 0; j < openBoundary.points.length; j++) {
        const point = openBoundary.points[j];
        const distance = Math.sqrt(
          Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
        );
        if (distance <= clickRadius) {
          return { 
            type: 'openBoundary', 
            elementIndex: i, 
            pointIndex: j, 
            point: point,
            distance: distance 
          };
        }
      }
    }
  }
  
  
  for (let i = 0; i < elements.waypoints.length; i++) {
    const waypoint = elements.waypoints[i];
    const distance = Math.sqrt(
      Math.pow(worldPoint.x - waypoint.center.x, 2) + Math.pow(worldPoint.y - waypoint.center.y, 2)
    );
    if (distance <= clickRadius) {
      return { 
        type: 'waypoint', 
        elementIndex: i, 
        point: waypoint.center,
        distance: distance 
      };
    }
  }
  
  
  for (let i = 0; i < elements.boundaries.length; i++) {
    const boundary = elements.boundaries[i];
    for (let j = 0; j < boundary.points.length; j++) {
      const point = boundary.points[j];
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
      );
      if (distance <= clickRadius) {
        return { 
          type: 'boundary', 
          elementIndex: i, 
          pointIndex: j, 
          point: point,
          distance: distance 
        };
      }
    }
  }
  
  
  if (elements.obstacles) {
    for (let i = 0; i < elements.obstacles.length; i++) {
      const obstacle = elements.obstacles[i];
      for (let j = 0; j < obstacle.points.length; j++) {
        const point = obstacle.points[j];
        const distance = Math.sqrt(
          Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
        );
        if (distance <= clickRadius) {
          return { 
            type: 'obstacle', 
            elementIndex: i, 
            pointIndex: j, 
            point: point,
            distance: distance 
          };
        }
      }
    }
  }
  
  
  for (let i = 0; i < elements.exits.length; i++) {
    const exit = elements.exits[i];
    for (let j = 0; j < exit.points.length; j++) {
      const point = exit.points[j];
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
      );
      if (distance <= clickRadius) {
        return { 
          type: 'exit', 
          elementIndex: i, 
          pointIndex: j, 
          point: point,
          distance: distance 
        };
      }
    }
  }
  
  
  for (let i = 0; i < elements.distributions.length; i++) {
    const distribution = elements.distributions[i];
    for (let j = 0; j < distribution.points.length; j++) {
      const point = distribution.points[j];
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - point.x, 2) + Math.pow(worldPoint.y - point.y, 2)
      );
      if (distance <= clickRadius) {
        return { 
          type: 'distribution', 
          elementIndex: i, 
          pointIndex: j, 
          point: point,
          distance: distance 
        };
      }
    }
  }
  
  return null;
};


export const findElementAtPoint = (world, elements) => {
  const tolerance = 1; 
  
  
  for (let i = 0; i < elements.waypoints.length; i++) {
    const waypoint = elements.waypoints[i];
    const distance = Math.sqrt(
      Math.pow(world.x - waypoint.center.x, 2) + 
      Math.pow(world.y - waypoint.center.y, 2)
    );
    if (distance <= waypoint.radius + tolerance) {
      return { 
        type: 'waypoint', 
        element: waypoint, 
        elementIndex: i,
        clickedPoint: world
      };
    }
  }
  
  
  const polygonTypes = [
    { name: 'boundary', array: elements.boundaries, allowInsideClick: false }, 
    { name: 'exit', array: elements.exits, allowInsideClick: true },
    { name: 'distribution', array: elements.distributions, allowInsideClick: true },
    { name: 'obstacle', array: elements.obstacles || [], allowInsideClick: true }
  ];
  
  for (const polygonType of polygonTypes) {
    for (let i = 0; i < polygonType.array.length; i++) {
      const element = polygonType.array[i];
      if (!element.points || element.points.length < 3) continue;
      
      
      if (polygonType.allowInsideClick) {
        
        let inside = false;
        const points = element.points;
        
        for (let j = 0, k = points.length - 1; j < points.length; k = j++) {
          if (((points[j].y > world.y) !== (points[k].y > world.y)) &&
              (world.x < (points[k].x - points[j].x) * (world.y - points[j].y) / (points[k].y - points[j].y) + points[j].x)) {
            inside = !inside;
          }
        }
        
        if (inside) {
          return { 
            type: polygonType.name, 
            element: element, 
            elementIndex: i,
            clickedPoint: world
          };
        }
      }
      
      
      const points = element.points;
      for (let j = 0; j < points.length; j++) {
        const p1 = points[j];
        const p2 = points[(j + 1) % points.length];
        
        
        const A = world.x - p1.x;
        const B = world.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue; 
        
        let t = Math.max(0, Math.min(1, dot / lenSq));
        
        const projection = {
          x: p1.x + t * C,
          y: p1.y + t * D
        };
        
        const distance = Math.sqrt(
          Math.pow(world.x - projection.x, 2) + 
          Math.pow(world.y - projection.y, 2)
        );
        
        if (distance <= tolerance) {
          return { 
            type: polygonType.name, 
            element: element, 
            elementIndex: i,
            clickedPoint: world,
            edgeIndex: j
          };
        }
      }
    }
  }
  
  
  if (elements.openBoundaries) {
    for (let i = 0; i < elements.openBoundaries.length; i++) {
      const openBoundary = elements.openBoundaries[i];
      if (!openBoundary.points || openBoundary.points.length < 2) continue;
      
      
      for (let j = 0; j < openBoundary.points.length - 1; j++) {
        const p1 = openBoundary.points[j];
        const p2 = openBoundary.points[j + 1];
        
        
        const A = world.x - p1.x;
        const B = world.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        let t = Math.max(0, Math.min(1, dot / lenSq));
        
        const projection = {
          x: p1.x + t * C,
          y: p1.y + t * D
        };
        
        const distance = Math.sqrt(
          Math.pow(world.x - projection.x, 2) + 
          Math.pow(world.y - projection.y, 2)
        );
        
        if (distance <= tolerance) {
          return { 
            type: 'openBoundary', 
            element: openBoundary, 
            elementIndex: i,
            clickedPoint: world,
            edgeIndex: j
          };
        }
      }
    }
  }
  
  return null;
};


export const getElementsForExport = (elements) => {
  const exportData = {
    boundaries: elements.boundaries || [],
    exits: elements.exits || [],
    distributions: elements.distributions || [],
    waypoints: elements.waypoints || [],
    obstacles: elements.obstacles || []
  };
  
  
  if (elements.openBoundaries && elements.openBoundaries.length > 0) {
    exportData.openBoundaries = elements.openBoundaries;
  }
  
  return exportData;
};

export const findSnapVertex = (world, activeBoundary, zoom) => {
  if (activeBoundary.length === 0) return null;
  const snapThreshold = SNAP_RADIUS / zoom;
  
  for (let i = 0; i < activeBoundary.length; i++) {
    const point = activeBoundary[i];
    const distance = Math.sqrt(Math.pow(world.x - point.x, 2) + Math.pow(world.y - point.y, 2));
    if (distance <= snapThreshold) return { pointIndex: i, point: point };
  }
  
  return null;
};


export const getElementCenter = (elementData) => {
  if (elementData.type === 'waypoint') return elementData.element.center;
  if (elementData.type === 'distribution' || elementData.type === 'exit' || elementData.type === 'obstacle') {
    const points = elementData.element.points;
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x: centerX, y: centerY };
  }
  return null;
};

export const isPointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) && 
        (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
};


export const isRectangleInWalkableArea = (rectPoints, boundaries) => {
  if (boundaries.length === 0) return false;
  
  
  for (const point of rectPoints) {
    let isInsideAnyBoundary = false;
    for (const boundary of boundaries) {
      if (boundary.closed && boundary.points.length >= 3) {
        if (isPointInPolygon(point, boundary.points)) {
          isInsideAnyBoundary = true;
          break;
        }
      }
    }
    if (!isInsideAnyBoundary) {
      return false;
    }
  }
  return true;
};


export const isPointInWalkableArea = (point, boundaries) => {
  if (boundaries.length === 0) return false;
  
  for (const boundary of boundaries) {
    if (boundary.closed && boundary.points.length >= 3) {
      if (isPointInPolygon(point, boundary.points)) {
        return true;
      }
    }
  }
  return false;
};


export const findLongestPath = (adjacency, startVertex, maxLength) => {
  const visited = new Set();
  
  function dfs(current, currentPath) {
    if (currentPath.length > maxLength) return currentPath;
    currentPath.push(current);
    visited.add(current);
    
    const neighbors = adjacency[current] || [];
    let bestContinuation = [...currentPath];
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const continuation = dfs(neighbor, [...currentPath]);
        if (continuation.length > bestContinuation.length) {
          bestContinuation = continuation;
        }
      } else if (neighbor === startVertex && currentPath.length >= 3) {
        return [...currentPath, neighbor];
      }
    }
    
    visited.delete(current);
    return bestContinuation;
  }
  
  return dfs(startVertex, []);
};

export const isPolygonClosed = (activeBoundary, connectionList) => {
  if (activeBoundary.length < 3 || connectionList.length < 3) return false;
  
  const adjacency = {};
  connectionList.forEach(conn => {
    if (!adjacency[conn.from]) adjacency[conn.from] = [];
    if (!adjacency[conn.to]) adjacency[conn.to] = [];
    adjacency[conn.from].push(conn.to);
    adjacency[conn.to].push(conn.from);
  });
  
  const connectedVertices = Object.keys(adjacency).map(k => parseInt(k));
  if (connectedVertices.length < 3) return false;
  
  const verticesWithTwoConnections = connectedVertices.filter(v => adjacency[v] && adjacency[v].length === 2);
  if (verticesWithTwoConnections.length >= 3) {
    const start = verticesWithTwoConnections[0];
    const visited = new Set();
    let current = start;
    let pathLength = 0;
    
    do {
      visited.add(current);
      pathLength++;
      const neighbors = adjacency[current];
      let nextVertex = null;
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          nextVertex = neighbor;
          break;
        } else if (neighbor === start && pathLength >= 3) {
          return true;
        }
      }
      
      if (nextVertex === null) break;
      current = nextVertex;
      if (pathLength > activeBoundary.length) break;
    } while (current !== start);
    
    return visited.size >= verticesWithTwoConnections.length && pathLength >= 3;
  }
  
  return false;
};


export const isPolygonInsideExistingPolygons = (newPolygonPoints, existingElements, elementType) => {
  const elementsToCheck = existingElements[elementType] || [];
  
  
  for (const point of newPolygonPoints) {
    
    for (const existingElement of elementsToCheck) {
      if (existingElement.points && existingElement.points.length >= 3) {
        if (isPointInPolygon(point, existingElement.points)) {
          return true; 
        }
      }
    }
  }
  return false;
};


export const hasExistingPolygonsInsideNewPolygon = (newPolygonPoints, existingElements, elementType) => {
  const elementsToCheck = existingElements[elementType] || [];
  
  for (const existingElement of elementsToCheck) {
    if (existingElement.points && existingElement.points.length >= 3) {
      
      for (const existingPoint of existingElement.points) {
        if (isPointInPolygon(existingPoint, newPolygonPoints)) {
          return true; 
        }
      }
    }
  }
  return false;
};


export const isPolygonOverlappingWithSameType = (newPolygonPoints, existingElements, elementType) => {
  return isPolygonInsideExistingPolygons(newPolygonPoints, existingElements, elementType) ||
         hasExistingPolygonsInsideNewPolygon(newPolygonPoints, existingElements, elementType);
};


export const calculatePolygonArea = (points) => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};


export const meetsMinimumArea = (points, minAreaInSquareMeters = 0.5) => {
  const areaInWorldUnits = calculatePolygonArea(points);
  
  const areaInSquareMeters = areaInWorldUnits / (GRID_SIZE * GRID_SIZE);
  return areaInSquareMeters >= minAreaInSquareMeters;
};

export const calculateGeometryBounds = (elements) => {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let hasGeometry = false;

  const polygonElements = [
    ...elements.boundaries,
    ...elements.exits,
    ...elements.distributions,
    ...elements.obstacles,
    ...(elements.openBoundaries || [])
  ];
  
  polygonElements.forEach((element, index) => {
    if (element.points && element.points.length > 0) {
      element.points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        hasGeometry = true;
      });
    }
  });
  
  
  elements.waypoints.forEach((waypoint, index) => {
    if (waypoint.center) {
      const radius = waypoint.radius || 0;
      minX = Math.min(minX, waypoint.center.x - radius);
      maxX = Math.max(maxX, waypoint.center.x + radius);
      minY = Math.min(minY, waypoint.center.y - radius);
      maxY = Math.max(maxY, waypoint.center.y + radius);
      hasGeometry = true;
    }
  });
  
  const result = hasGeometry && isFinite(minX) ? { minX, maxX, minY, maxY } : null;
  return result;
};

export const transformToSimulationCoords = (element, bounds) => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    if (element.points) {
      return {
        ...element,
        points: element.points.map(point => ({
          x: (point.x - centerX) * SCALE_FACTOR,
          y: -(point.y - centerY) * SCALE_FACTOR
        }))
      };
    } else if (element.center) {
      return {
        ...element,
        center: {
          x: (element.center.x - centerX) * SCALE_FACTOR,
          y: -(element.center.y - centerY) * SCALE_FACTOR
        },
        radius: element.radius * SCALE_FACTOR
      };
    }
    
    return element;
  };

  
export const simulationToScreen =(simX, simY, zoom, viewOffset) => {

    const x = simX * DISPLAY_SCALE * zoom + viewOffset.x;
    const y = -simY * DISPLAY_SCALE * zoom + viewOffset.y;
    return { x, y };
};