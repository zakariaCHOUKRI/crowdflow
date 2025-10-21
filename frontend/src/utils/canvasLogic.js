import { getElementCenter, isPointInPolygon } from './canvasUtils.js';

export const isPolygonInWalkableArea = (polygonPoints, boundaries) => {
  if (!boundaries || boundaries.length === 0) return false;

  for (const point of polygonPoints) {
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
      return false; // A point was found outside all boundaries
    }
  }
  return true; // All points are inside
};


export const findJourneyConnectionAtPoint = (world, connections) => {
  const tolerance = 8; // Click tolerance in pixels

  for (let i = 0; i < connections.length; i++) {
    const connection = connections[i];
    const fromCenter = getElementCenter(connection.from);
    const toCenter = getElementCenter(connection.to);

    if (fromCenter && toCenter) {
      const A = world.x - fromCenter.x;
      const B = world.y - fromCenter.y;
      const C = toCenter.x - fromCenter.x;
      const D = toCenter.y - fromCenter.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;

      if (lenSq === 0) continue;

      let t = Math.max(0, Math.min(1, dot / lenSq));

      const projection = {
        x: fromCenter.x + t * C,
        y: fromCenter.y + t * D
      };

      const distance = Math.sqrt(
        Math.pow(world.x - projection.x, 2) +
        Math.pow(world.y - projection.y, 2)
      );

      if (distance <= tolerance) {
        return {
          type: 'journey',
          connectionIndex: i,
          connection: connection
        };
      }
    }
  }
  return null;
};


export const getCursorStyle = ({ isSimulationMode, isPanning, isDraggingVertex, drawingMode, hoveredVertex, hoveredSnapVertex }) => {
  if (isSimulationMode) return 'default';
  if (isPanning) return 'grabbing';
  if (isDraggingVertex) return 'grabbing';
  
  if (drawingMode === 'delete') return 'crosshair';
  if (drawingMode === 'walkablearea' || drawingMode === 'obstacle') return 'crosshair';
  if (drawingMode === 'select' || drawingMode === 'journey') return 'pointer';
  if (drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'waypoint') return 'copy';
  
  if (hoveredVertex) return 'pointer';
  if (hoveredSnapVertex) return 'crosshair';
  
  return 'default';
};


export const isPointInExistingObstacle = (point, obstacles) => {
  if (!obstacles || obstacles.length === 0) return false;

  for (const obstacle of obstacles) {
    if (obstacle.closed && obstacle.points.length >= 3) {
      if (isPointInPolygon(point, obstacle.points)) {
        return true;
      }
    }
  }
  return false;
};