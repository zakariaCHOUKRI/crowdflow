import { useState, useCallback, useEffect } from 'react';
import {
  findVertexAtPoint,
  findSnapVertex,
  findElementAtPoint,
  findLongestPath,
  isPolygonClosed,
  isRectangleInWalkableArea,
  isPointInWalkableArea,
  meetsMinimumArea,
  isPolygonOverlappingWithSameType,
  isPointInPolygon,

  simulationToScreen,
  snapToGrid,
  snapToAngle,
  GRID_SNAP_THRESHOLD
} from '../utils/canvasUtils.js';
import { isPointInExistingObstacle, isPolygonInWalkableArea, findJourneyConnectionAtPoint } from '../utils/canvasLogic.js';


export const useCanvasLogic = ({
  drawingMode,
  elements,
  onElementsChange,
  journeyConnections,
  onJourneyConnectionsChange,
  onBoundaryComplete,
  screenToWorld,
  zoom,
  showErrorToast,

  waypointRouting,
  onWaypointRoutingChange,

  getDistributionSet,
  getDistributionsInSet,
  distributionSets,
  setDistributionSets
}) => {
  const [activeBoundary, setActiveBoundary] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [showPreviewLine, setShowPreviewLine] = useState(false);
  const [lastConnectedPoint, setLastConnectedPoint] = useState(null);
  const [connections, setConnections] = useState([]);
  const [continuingFromOpenBoundary, setContinuingFromOpenBoundary] = useState(null);
  const [mergedOpenBoundaries, setMergedOpenBoundaries] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]);

  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [draggedVertex, setDraggedVertex] = useState(null);
  const [hoveredVertex, setHoveredVertex] = useState(null);
  const [hoveredSnapVertex, setHoveredSnapVertex] = useState(null);

  const [snapGuide, setSnapGuide] = useState(null);

  // --- Drawing Logic ---
  
  const cancelBoundaryDrawing = useCallback(() => {
    setActiveBoundary([]);
    setShowPreviewLine(false);
    setPreviewPoint(null);
    setLastConnectedPoint(null);
    setHoveredSnapVertex(null);
    setConnections([]);
    setContinuingFromOpenBoundary(null);
    setMergedOpenBoundaries([]);
  }, []);

  const disconnectFromVertex = useCallback(() => {
      setShowPreviewLine(false);
      setPreviewPoint(null);
      setLastConnectedPoint(null);
      setHoveredSnapVertex(null);
    }, []);

  const saveIncompleteAsOpenBoundary = useCallback(() => {
    if (activeBoundary.length < 2) return null;
    
    // This logic is complex and specific, so we keep it contained here.
    // It could also be moved to a utility if it gets too large.
    const newElements = { ...elements };
    if (!newElements.openBoundaries) newElements.openBoundaries = [];
    const elementType = drawingMode === 'obstacle' ? 'obstacle' : 'boundary';

    const openBoundary = {
      id: `open_${elementType}_${Date.now()}`,
      points: activeBoundary.slice(),
      closed: false,
      type: elementType
    };
    newElements.openBoundaries.push(openBoundary);
    
    return { newElements, savedBoundaries: [openBoundary] };
  }, [activeBoundary, connections, elements, drawingMode]);

  const saveIncompleteBoundary = useCallback(() => {
    if (activeBoundary.length >= 2) {
      const result = saveIncompleteAsOpenBoundary();
      if (result && result.savedBoundaries.length > 0) {
        onElementsChange(result.newElements);
      }
    }
    cancelBoundaryDrawing();
  }, [activeBoundary.length, saveIncompleteAsOpenBoundary, onElementsChange, cancelBoundaryDrawing]);


  const completeBoundary = useCallback((connectionsToUse = null) => {
    const currentConnections = connectionsToUse || connections;
    if (activeBoundary.length < 3) return;

    const adjacency = {};
    currentConnections.forEach(conn => {
        if (!adjacency[conn.from]) adjacency[conn.from] = [];
        if (!adjacency[conn.to]) adjacency[conn.to] = [];
        adjacency[conn.from].push(conn.to);
        adjacency[conn.to].push(conn.from);
    });

    const path = findLongestPath(adjacency, 0, activeBoundary.length);
    const orderedPoints = path.map(vertexIndex => activeBoundary[vertexIndex]);
    
    let elementType = drawingMode === 'obstacle' ? 'obstacle' : 'boundary';

    if (elementType === 'obstacle' && !isPolygonInWalkableArea(orderedPoints, elements.boundaries)) {
        showErrorToast('Obstacle must be entirely within walkable boundaries');
        return;
    }

    const element = { id: `${elementType}_${Date.now()}`, points: orderedPoints, closed: true };

    if (elementType === 'obstacle') {
        const newElements = { ...elements, obstacles: [...(elements.obstacles || []), element] };
        onElementsChange(newElements);
    } else {
        onBoundaryComplete(element, { continuingFromOpenBoundary, mergedOpenBoundaries });
    }

    cancelBoundaryDrawing();
  }, [activeBoundary, connections, drawingMode, elements, onBoundaryComplete, onElementsChange, showErrorToast, continuingFromOpenBoundary, mergedOpenBoundaries]);


  const loadOpenBoundaryForContinuation = useCallback((openBoundary, clickedVertexIndex = null) => {
      if (activeBoundary.length === 0) {
        setActiveBoundary(openBoundary.points);
        setContinuingFromOpenBoundary(openBoundary);
        setMergedOpenBoundaries([openBoundary.id]);
        
        const newConnections = [];
        for (let i = 0; i < openBoundary.points.length - 1; i++) {
          newConnections.push({ from: i, to: i + 1 });
        }
        setConnections(newConnections);
        
        setLastConnectedPoint(clickedVertexIndex !== null ? clickedVertexIndex : openBoundary.points.length - 1);
        setShowPreviewLine(true);
      } else {
        const currentBoundaryLength = activeBoundary.length;
        
        setMergedOpenBoundaries(prev => [...prev, openBoundary.id]);
        
        setActiveBoundary(prev => [...prev, ...openBoundary.points]);
        
        const targetVertexIndex = currentBoundaryLength + clickedVertexIndex;
        const connectionToMerged = { from: lastConnectedPoint, to: targetVertexIndex };
        
        const mergedConnections = [];
        for (let i = 0; i < openBoundary.points.length - 1; i++) {
          mergedConnections.push({ 
            from: currentBoundaryLength + i, 
            to: currentBoundaryLength + i + 1 
          });
        }
        
        setConnections(prev => [...prev, connectionToMerged, ...mergedConnections]);
        
        setLastConnectedPoint(targetVertexIndex);
        setShowPreviewLine(true);
       
      }
    }, [activeBoundary.length, lastConnectedPoint]);
  
  // --- Element & Vertex Manipulation ---

  const updateVertexPosition = useCallback((vertex, newPosition) => {
  
    if (vertex.type !== 'boundary' && vertex.type !== 'activeBoundary') {
    if (!isPointInWalkableArea(newPosition, elements.boundaries)) {
      // Show feedback and don't update
      showErrorToast && showErrorToast('Vertex must stay within walkable boundaries');
      return;
    }
  }

  const tempElements = JSON.parse(JSON.stringify(elements));
  let tempElement;
  
  if (vertex.type === 'waypoint') {
    tempElement = {
      ...tempElements.waypoints[vertex.elementIndex],
      center: newPosition
    };
    tempElements.waypoints[vertex.elementIndex] = tempElement;
  } else if (vertex.type !== 'boundary' && vertex.type !== 'activeBoundary') {
    const arrayName = vertex.type === 'exit' ? 'exits' :
                     vertex.type === 'distribution' ? 'distributions' :
                     vertex.type === 'obstacle' ? 'obstacles' : null;
    
    if (arrayName && tempElements[arrayName] && tempElements[arrayName][vertex.elementIndex]) {
      tempElement = { ...tempElements[arrayName][vertex.elementIndex] };
      tempElement.points = [...tempElement.points];
      tempElement.points[vertex.pointIndex] = newPosition;
      tempElements[arrayName][vertex.elementIndex] = tempElement;
    }
  }
  
 


  const newElements = JSON.parse(JSON.stringify(elements)); // Deep copy to ensure re-render
  
  if (vertex.type === 'activeBoundary') {
    setActiveBoundary(prev => {
      const newBoundary = [...prev];
      newBoundary[vertex.pointIndex] = newPosition;
      return newBoundary;
    });
  } else {
    // FIX: Correct array name mapping
    let arrayName;
    switch (vertex.type) {
      case 'boundary':
        arrayName = 'boundaries'; // NOT 'boundarys'
        break;
      case 'exit':
        arrayName = 'exits';
        break;
      case 'distribution':
        arrayName = 'distributions';
        break;
      case 'obstacle':  
        arrayName = 'obstacles';
        break;
      case 'waypoint':
        arrayName = 'waypoints';
        break;
      default:
        console.error('❌ Unknown vertex type:', vertex.type);
        return;
    }
        
    if (newElements[arrayName] && newElements[arrayName][vertex.elementIndex]) {
      if (vertex.type === 'waypoint') {
        newElements[arrayName][vertex.elementIndex].center = newPosition;
      } else {
        newElements[arrayName][vertex.elementIndex].points[vertex.pointIndex] = newPosition;
      }
      
      onElementsChange(newElements);
    } else {
      console.error('❌ Could not find element:', {
        arrayName,
        elementIndex: vertex.elementIndex,
        available: Object.keys(newElements),
        arrayExists: !!newElements[arrayName],
        elementExists: newElements[arrayName] ? !!newElements[arrayName][vertex.elementIndex] : false
      });
    }
  }
}, [elements, onElementsChange]);

const deleteElementOrVertex = useCallback((world) => {
  const journeyConnection = findJourneyConnectionAtPoint(world, journeyConnections);
  if (journeyConnection) {
    // NEW: Check if this connection is from a distribution in a set
    const connectionToDelete = journeyConnections[journeyConnection.connectionIndex];
    const fromId = connectionToDelete.from?.element?.id || connectionToDelete.fromId;
    const distributionSetId = getDistributionSet && getDistributionSet(fromId);
    
    if (distributionSetId) {
      // Delete ALL connections from distributions in this set
      const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
      const setDistributionIds = setDistributions.map(d => d.id);
      
      const newConnections = journeyConnections.filter(conn => {
        const connFromId = conn.from?.element?.id || conn.fromId;
        return !setDistributionIds.includes(connFromId);
      });
      
      onJourneyConnectionsChange && onJourneyConnectionsChange(newConnections);
      showErrorToast && showErrorToast(`Deleted all connections for distribution set (${setDistributions.length} connections)`);
    } else {
      // Original single connection deletion
      const newConnections = journeyConnections.filter((_, index) => index !== journeyConnection.connectionIndex);
      onJourneyConnectionsChange && onJourneyConnectionsChange(newConnections);
    }
    return true;
  }
    
  const vertex = findVertexAtPoint(world, elements, zoom, activeBoundary);
  const element = findElementAtPoint(world, elements);
  
  if (vertex) {
    const newElements = { ...elements };
    
    if (vertex.type === 'waypoint') {
      const waypointToDelete = newElements.waypoints[vertex.elementIndex];
      
      newElements.waypoints.splice(vertex.elementIndex, 1);
      
      // Delete all journey connections involving this waypoint
      const filteredConnections = journeyConnections.filter(connection => 
        connection.from.element.id !== waypointToDelete.id && 
        connection.to.element.id !== waypointToDelete.id
      );
      
      onElementsChange && onElementsChange(newElements);
      onJourneyConnectionsChange && onJourneyConnectionsChange(filteredConnections);
      return true;
    } else if (vertex.type === 'openBoundary') {
      newElements.openBoundaries.splice(vertex.elementIndex, 1);
      onElementsChange && onElementsChange(newElements);
      return true;
    } else if (vertex.type === 'obstacle') {
      const obstacle = newElements.obstacles[vertex.elementIndex];
      if (obstacle.points.length > 3) {
        obstacle.points.splice(vertex.pointIndex, 1);
        onElementsChange && onElementsChange(newElements);
        return true;
      }
    } else if (vertex.type === 'boundary' || vertex.type === 'exit' || vertex.type === 'distribution') {
      const elementArray = newElements[
        vertex.type === 'boundary' ? 'boundaries' : 
        vertex.type === 'exit' ? 'exits' : 'distributions'
      ];
      const element = elementArray[vertex.elementIndex];
      if (element.points.length > 3) {
        element.points.splice(vertex.pointIndex, 1);
        onElementsChange && onElementsChange(newElements);
        return true;
      }
    }
  } else if (element) {
    const newElements = { ...elements };
    
    if (element.type === 'boundary') {
      newElements.boundaries.splice(element.elementIndex, 1);
    } else if (element.type === 'exit') {
      const exitToDelete = newElements.exits[element.elementIndex];
      newElements.exits.splice(element.elementIndex, 1);

      // Clean up waypoint routing - remove references to this exit
      const newWaypointRouting = { ...waypointRouting };
      Object.keys(newWaypointRouting).forEach(waypointId => {
        Object.keys(newWaypointRouting[waypointId]).forEach(journeyId => {
          if (newWaypointRouting[waypointId][journeyId].destinations) {
            newWaypointRouting[waypointId][journeyId].destinations = 
              newWaypointRouting[waypointId][journeyId].destinations.filter(
                dest => dest.target !== exitToDelete.id
              );
          }
        });
      });

      onWaypointRoutingChange && onWaypointRoutingChange(newWaypointRouting);

      const filteredConnections = journeyConnections.filter(connection => {
        const fromId = connection.from?.element?.id || connection.fromId;
        const toId = connection.to?.element?.id || connection.toId;
        return fromId !== exitToDelete.id && toId !== exitToDelete.id;
      });

      onJourneyConnectionsChange && onJourneyConnectionsChange(filteredConnections);
    } else if (element.type === 'distribution') {
      // NEW: Handle distribution set deletion
      const distributionToDelete = newElements.distributions[element.elementIndex];
      const distributionSetId = getDistributionSet && getDistributionSet(distributionToDelete.id);
      
      if (distributionSetId) {
        // Delete ALL distributions in the set
        const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
        const setDistributionIds = setDistributions.map(d => d.id);
        
        // Remove ALL distributions in the set
        newElements.distributions = newElements.distributions.filter(d => 
          !setDistributionIds.includes(d.id)
        );
        
        // Remove ALL connections from distributions in the set
        const filteredConnections = journeyConnections.filter(connection => {
          const fromId = connection.from?.element?.id || connection.fromId;
          return !setDistributionIds.includes(fromId);
        });
        
        // Remove the set itself
        const newSets = { ...distributionSets };
        delete newSets[distributionSetId];
        setDistributionSets && setDistributionSets(newSets);
        
        // Clean up waypoint routing for all distributions in the set
        const newWaypointRouting = { ...waypointRouting };
        Object.keys(newWaypointRouting).forEach(waypointId => {
          Object.keys(newWaypointRouting[waypointId]).forEach(journeyId => {
            if (newWaypointRouting[waypointId][journeyId].destinations) {
              newWaypointRouting[waypointId][journeyId].destinations = 
                newWaypointRouting[waypointId][journeyId].destinations.filter(
                  dest => !setDistributionIds.includes(dest.target)
                );
            }
          });
        });
        
        onWaypointRoutingChange && onWaypointRoutingChange(newWaypointRouting);
        onJourneyConnectionsChange && onJourneyConnectionsChange(filteredConnections);
        showErrorToast && showErrorToast(`Deleted distribution set with ${setDistributions.length} distributions`);
      } else {
        // Original single distribution deletion
        newElements.distributions.splice(element.elementIndex, 1);
      }
    } else if (element.type === 'obstacle') {
      newElements.obstacles.splice(element.elementIndex, 1);
    } else if (element.type === 'waypoint') {
      const waypointToDelete = newElements.waypoints[element.elementIndex];
      newElements.waypoints.splice(element.elementIndex, 1);
      
      // Delete all journey connections involving this waypoint
      const filteredConnections = journeyConnections.filter(connection => 
        connection.from.element.id !== waypointToDelete.id && 
        connection.to.element.id !== waypointToDelete.id
      );

      // Clean up waypoint routing
      if (onWaypointRoutingChange && waypointRouting) {
        const newWaypointRouting = { ...waypointRouting };
        delete newWaypointRouting[waypointToDelete.id];
        
        // Remove references to this waypoint from other waypoints' routing
        Object.keys(newWaypointRouting).forEach(otherWaypointId => {
          Object.keys(newWaypointRouting[otherWaypointId]).forEach(journeyId => {
            if (newWaypointRouting[otherWaypointId][journeyId].destinations) {
              newWaypointRouting[otherWaypointId][journeyId].destinations = 
                newWaypointRouting[otherWaypointId][journeyId].destinations.filter(
                  dest => dest.target !== waypointToDelete.id
                );
            }
          });
        });
        onWaypointRoutingChange(newWaypointRouting);
      }

      onJourneyConnectionsChange && onJourneyConnectionsChange(filteredConnections);
    }
    
    onElementsChange && onElementsChange(newElements);
    return true;
  }
  
  return false;
}, [
  elements, 
  zoom, 
  activeBoundary, 
  onElementsChange, 
  journeyConnections, 
  onJourneyConnectionsChange,
  waypointRouting,
  onWaypointRoutingChange,
  getDistributionSet,
  getDistributionsInSet,
  distributionSets,
  setDistributionSets,
  showErrorToast
]);


  // Effect to handle cleanup when changing drawing modes
  useEffect(() => {
    if (drawingMode !== 'walkablearea' && drawingMode !== 'obstacle') {
        if (activeBoundary.length >= 2) {
            saveIncompleteBoundary();
        } else {
            cancelBoundaryDrawing();
        }
    }
  }, [drawingMode, activeBoundary.length]);

  const handleMouseMoveWithSnapping = useCallback((worldPos) => {
    if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && 
        showPreviewLine && lastConnectedPoint !== null) {
      
      let snappedPoint = worldPos;
      
      // Apply grid snapping first
      const gridSnapped = snapToGrid(worldPos, zoom);
      if (gridSnapped.snapped) {
        snappedPoint = { x: gridSnapped.x, y: gridSnapped.y };
      }
      
      // Apply angle snapping from last connected point
      const fromPoint = activeBoundary[lastConnectedPoint];
      if (fromPoint) {
        const angleSnapped = snapToAngle(fromPoint, snappedPoint, zoom);
        if (angleSnapped.snapped) {
          snappedPoint = angleSnapped.point;
        }
      }
      
      setPreviewPoint(snappedPoint);
    }
  }, [drawingMode, showPreviewLine, lastConnectedPoint, activeBoundary, zoom]);


  // Return all the state and handlers the component will need
  return {
    // State
    activeBoundary,
    previewPoint,
    showPreviewLine,
    lastConnectedPoint,
    connections,
    isDragging,
    dragStart,
    dragCurrent,
    selectedElements,
    isDraggingVertex,
    hoveredVertex,
    hoveredSnapVertex,
    setIsDragging,
    setDragStart,
    setDragCurrent,
    setSelectedElements,

    setIsDraggingVertex,
    draggedVertex,
    setDraggedVertex,
    setHoveredVertex,
    snapGuide,
    setSnapGuide,
    cancelBoundaryDrawing,

    disconnectFromVertex,
    completeBoundary,
    setActiveBoundary,

    setConnections,
    setLastConnectedPoint,
    setShowPreviewLine,

    setHoveredSnapVertex,
    setPreviewPoint,

    loadOpenBoundaryForContinuation,
    updateVertexPosition,
    deleteElementOrVertex,

    handleMouseMoveWithSnapping
  };
};