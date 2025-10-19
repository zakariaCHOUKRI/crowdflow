import { useCallback, useEffect } from 'react';
import { 
  SNAP_RADIUS,
  SCALE_FACTOR,
  DISPLAY_SCALE,
  createCoordinateConverters,
  findVertexAtPoint,
  findSnapVertex,
  findElementAtPoint,
  findLongestPath, 
  isPolygonClosed,
  getElementsForExport,
  isRectangleInWalkableArea,
  isPointInWalkableArea,
  getElementCenter,
  isPointInPolygon,
  isPolygonOverlappingWithSameType,
  meetsMinimumArea,
  transformToSimulationCoords,
  simulationToScreen,
  calculateGeometryBounds,

  snapToGrid,
  snapToAngle,
  GRID_SNAP_THRESHOLD
} from '../utils/canvasUtils.js';
export const useCanvasHandlers = ({
  deleteElementOrVertex,
  findVertexAtPoint,
  loadOpenBoundaryForContinuation,
  lastConnectedPoint,
  connections,
  setConnections,
  isPolygonClosed,
  setLastConnectedPoint,
  setShowPreviewLine,
  setIsDraggingVertex,
  setDraggedVertex,
  selectedElements,
  setSelectedElements,
  showErrorToast,
  setSnapGuide,
  findSnapVertex,
  isPointInWalkableArea,
  isPointInExistingObstacle,
  snapGuide,
  setActiveBoundary,
  setIsDragging,
  setDragStart,
  setDragCurrent,
  setMousePosition,
  setHoveredDistribution,
  canvasSize,
  isDragging,
  isDraggingVertex,
  setDistributionTooltipPosition,
  setHoveredSnapVertex,
  setPreviewPoint,
  lastPanPoint,
  draggedVertex,
  updateVertexPosition,
  dragStart,
  dragCurrent,
  isRectangleInWalkableArea,
  meetsMinimumArea,
  isPolygonOverlappingWithSameType,

  // State values
  currentFrame,
  trajectoryData,
  isPlaying,
  isPanning,
  
  // State setters
  setCurrentFrame,
  setIsPlaying,
  setAgentTrails,
  setIsPanning,
  setLastPanPoint,

  isSimulationMode,
  drawingMode,
  activeBoundary,
  completeBoundary,

  canvasRef,
  zoom,
  setZoom,
  viewOffset,
  setViewOffset,

  elements,
  onElementsChange,
  hoveredVertex,
  disconnectFromVertex,
  saveIncompleteBoundary,
  showPreviewLine,
  setHoveredVertex,

  onDistributionClick,
  journeyConnections,
  onJourneyConnectionsChange,
  screenToWorld,
  findElementAtPoint,

  onUndo,
  onRedo,

  agentCounts,
  hoveredWaypoint,
  setHoveredWaypoint,
  hoveredExit,
  setHoveredExit,
  setWaypointTooltipPosition,
  setExitTooltipPosition,

  waypointRouting,
  onWaypointRoutingChange,

  saveToHistory,
  updateElementsWithHistory,
  updateJourneyConnectionsWithHistory,
  validateElements,
  dragState,
  setDragState,

  onWaypointClick,

  originalVertexState,
  setOriginalVertexState,

  onSelectedJourneyChange,

  distributionSets,
  getDistributionSet,
  getDistributionsInSet,

  currentSnappedPoint,
  setCurrentSnappedPoint,

  worldToScreen,

  editingWaypoint,
  setEditingWaypoint,
  isDraggingRadius,
  setIsDraggingRadius
}) => {
  const handleSimulationPlay = useCallback(() => {
    if (currentFrame >= trajectoryData.length - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  }, [currentFrame, trajectoryData.length, isPlaying, setCurrentFrame, setIsPlaying]);

  const handleSimulationReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrame(0);
    setAgentTrails(new Map());
  }, [setIsPlaying, setCurrentFrame, setAgentTrails]);

  const handleSimulationMouseDown = useCallback((e) => {
      if (e.button === 1 || e.ctrlKey || e.shiftKey || e.code === 'Space' ) {
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
      }
    }, []);
  
    const handleSimulationMouseUp = useCallback((e) => {
      if (isPanning) {
        setIsPanning(false);
      }
    }, [isPanning]);
  
    const handleFrameChange = useCallback((e) => {
      const frame = parseInt(e.target.value);
      setCurrentFrame(frame);
      setIsPlaying(false);
    }, []);
    
    const handleDoubleClick = useCallback((e) => {
    if (isSimulationMode) return;
    
    if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && activeBoundary.length >= 3) {
      e.preventDefault();
      completeBoundary();
      return;
    }

    // Handle distribution double-click
    if (drawingMode === 'select' && onDistributionClick) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const world = screenToWorld(canvasX, canvasY);
      
      const clickedElement = findElementAtPoint(world, elements);
      if (clickedElement && clickedElement.type === 'distribution') {
        onDistributionClick(clickedElement.element.id);
        return;
      }
    }

    if (drawingMode === 'select' && onWaypointClick) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const world = screenToWorld(canvasX, canvasY);
      
      const clickedElement = findElementAtPoint(world, elements);
      if (clickedElement && clickedElement.type === 'waypoint') {
        onWaypointClick(clickedElement.element.id);
        return;
      }
    }
  }, [isSimulationMode, drawingMode, activeBoundary.length, completeBoundary, onDistributionClick, screenToWorld, findElementAtPoint, elements, canvasRef]);
      
  const handleRightClick = useCallback((e) => {
  // Prevent default context menu
  e.preventDefault();
  
  if (isSimulationMode) return;
  
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const world = screenToWorld(canvasX, canvasY);
  
  const clickedElement = findElementAtPoint(world, elements);
  
  if (clickedElement && clickedElement.type === 'distribution') {
    onDistributionClick(clickedElement.element.id);
    return;
  }

  if (clickedElement && clickedElement.type === 'waypoint') {
    onWaypointClick(clickedElement.element.id);
    return;
  }
  
  
}, [isSimulationMode, screenToWorld, elements, onDistributionClick]);

function distanceToLine(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Line start and end are the same point
    const dx = point.x - lineStart.x;
    const dy = point.y - lineStart.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  let param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        
        
        if (!canvasRef.current) return;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const currentZoom = zoom;
        
        
        const newZoom = Math.max(0.01, Math.min(5, currentZoom * zoomFactor));
        
        
        if (Math.abs(newZoom - currentZoom) < 0.001) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        
        const zoomRatio = newZoom / currentZoom;
        const newViewOffset = {
          x: mouseX - (mouseX - viewOffset.x) * zoomRatio,
          y: mouseY - (mouseY - viewOffset.y) * zoomRatio
        };
        
        
        setViewOffset(newViewOffset);
        setZoom(newZoom);
      }, [zoom, viewOffset, canvasRef, setZoom, setViewOffset]); 

    
      const handleKeyDown = useCallback((e) => {
        if (isSimulationMode && trajectoryData.length > 0) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newFrame = Math.max(0, currentFrame - 1);
      setCurrentFrame(newFrame);
      return;
    }
    
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newFrame = Math.min(trajectoryData.length - 1, currentFrame + 1);
      setCurrentFrame(newFrame);
      return;
    }
  }

        if (isSimulationMode) return;
        
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    
    const moveDistance = 5; // Pixels to move per arrow press
    const deltaX = e.key === 'ArrowLeft' ? -moveDistance : e.key === 'ArrowRight' ? moveDistance : 0;
    const deltaY = e.key === 'ArrowUp' ? -moveDistance : e.key === 'ArrowDown' ? moveDistance : 0;
    
    setViewOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    return;
  }
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          onUndo && onUndo();
          return;
        }
        
        if (e.ctrlKey && e.key === 'y') {
          e.preventDefault();
          onRedo && onRedo();
          return;
        }

        if (e.key === 'Escape') {
          if (drawingMode === 'walkablearea' || drawingMode === 'obstacle') {
            if (showPreviewLine) {
              disconnectFromVertex();
              e.preventDefault();
            } else if (activeBoundary.length > 0) {
              saveIncompleteBoundary();
              e.preventDefault();
            }
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (hoveredVertex) {
            if (hoveredVertex.type === 'waypoint') {
          const newElements = { ...elements };
          const waypointToDelete = newElements.waypoints[hoveredVertex.elementIndex];
          newElements.waypoints.splice(hoveredVertex.elementIndex, 1);
          
          // Delete all journey connections involving this waypoint
          const filteredConnections = journeyConnections.filter(connection => 
            connection.from.element.id !== waypointToDelete.id && 
            connection.to.element.id !== waypointToDelete.id
          );
          
          // Clean up waypoint routing - remove both the waypoint entry and references to it
          const newWaypointRouting = { ...waypointRouting };
          
          // Remove the waypoint's own routing entry
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
          
          onElementsChange && onElementsChange(newElements);
          onJourneyConnectionsChange && onJourneyConnectionsChange(filteredConnections);
          onWaypointRoutingChange && onWaypointRoutingChange(newWaypointRouting); // Add this line
        }
          else if (hoveredVertex.type === 'openBoundary') {
                        const newElements = { ...elements };
                        newElements.openBoundaries.splice(hoveredVertex.elementIndex, 1);
                        onElementsChange && onElementsChange(newElements);
                      } else if (hoveredVertex.type === 'obstacle') {
                        const newElements = { ...elements };
                        const obstacle = newElements.obstacles[hoveredVertex.elementIndex];
                        if (obstacle.points.length > 3) {
                          obstacle.points.splice(hoveredVertex.pointIndex, 1);
                          onElementsChange && onElementsChange(newElements);
                        }
                      } else {
                        const newElements = { ...elements };
                        const elementArray = newElements[hoveredVertex.type === 'boundary' ? 'boundaries' : hoveredVertex.type === 'exit' ? 'exits' : 'distributions'];
                        const element = elementArray[hoveredVertex.elementIndex];
                        if (element.points.length > 3) {
                          element.points.splice(hoveredVertex.pointIndex, 1);
                          onElementsChange && onElementsChange(newElements);
                        }
                      }
                      setHoveredVertex(null);
                    }
                  }
      }, [isSimulationMode, hoveredVertex, elements, onElementsChange, drawingMode, showPreviewLine, activeBoundary.length, disconnectFromVertex, saveIncompleteBoundary, setHoveredVertex, journeyConnections, onJourneyConnectionsChange, currentFrame, trajectoryData.length, setCurrentFrame, onUndo, onRedo]);
      
      
      
const validateJourneyStartAreas = useCallback((newConnection, existingConnections) => {
  const journeyId = newConnection.journeyId;
  if (!journeyId) return { valid: true };

  const fromElement = [...elements.distributions].find(el => el.id === newConnection.fromId);
  if (!fromElement) return { valid: true };

  // Check if distribution is in a set
  const distributionSetId = getDistributionSet && getDistributionSet(newConnection.fromId);
  
  if (distributionSetId) {
    // For distributions in sets, check if any distribution in the set already has a connection
    const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
    const setDistributionIds = setDistributions.map(d => d.id);
    
    const existingSetConnections = existingConnections.filter(conn => 
      setDistributionIds.includes(conn.fromId)
    );
    
    if (existingSetConnections.length > 0) {
      const existingConnection = existingSetConnections[0];
      if (existingConnection.journeyId !== journeyId) {
        return {
          valid: false,
          message: `Distributions in the same set must use the same journey. This set is already using ${existingConnection.journeyId}.`
        };
      }
    }
    
    // For sets: Allow same journey to be used by different distributions in the same set
    // Check if this journey is used by distributions NOT in this set
    const existingJourneyConnections = existingConnections.filter(conn => 
      conn.journeyId === journeyId
    );
    
    for (const conn of existingJourneyConnections) {
      const connFromElement = [...elements.distributions].find(el => el.id === conn.fromId);
      if (connFromElement) {
        const connDistributionSetId = getDistributionSet && getDistributionSet(conn.fromId);
        
        // If the existing connection is from a distribution not in our set, it's invalid
        if (connDistributionSetId !== distributionSetId) {
          return {
            valid: false,
            message: `Journey ${journeyId} is already used by distributions in a different set. Each journey can only be used by one set of distributions.`
          };
        }
      }
    }
  } else {
    // For individual distributions (not in sets)
    
    // Check if this distribution already has ANY outgoing connection
    const existingConnectionsFromThisDistribution = existingConnections.filter(conn => 
      conn.fromId === newConnection.fromId
    );
    
    if (existingConnectionsFromThisDistribution.length > 0) {
      return {
        valid: false,
        message: `This distribution already has an outgoing connection. Each distribution can only have one outgoing connection.`
      };
    }
    
    // Check if this journey is already used by ANY other distribution (individual or in sets)
    const existingJourneyConnections = existingConnections.filter(conn => 
      conn.journeyId === journeyId
    );
    
    for (const conn of existingJourneyConnections) {
      const connFromElement = [...elements.distributions].find(el => el.id === conn.fromId);
      if (connFromElement && conn.fromId !== newConnection.fromId) {
        return {
          valid: false,
          message: `Journey ${journeyId} is already used by another distribution. Each journey can only start from one distribution or set of distributions.`
        };
      }
    }
  }

  return { valid: true };
}, [elements.distributions, getDistributionSet, getDistributionsInSet]);

const handleRotateMouseDown = useCallback((e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const world = screenToWorld(canvasX, canvasY);
  
  const element = findElementAtPoint(world, elements);
  if (!element) return;
  
  // Don't allow rotating boundaries
  if (element.type === 'boundary') {
    showErrorToast && showErrorToast('Boundaries cannot be rotated');
    return;
  }
  
  saveToHistory && saveToHistory();
  
  // Pass the entire element object (with type and element properties) to getElementCenter
  const elementCenter = getElementCenter(element); // element already has {type, element}
  
  if (!elementCenter) {
    showErrorToast && showErrorToast('Cannot rotate this element');
    return;
  }
  
  setDragState({
    isDragging: true,
    draggedElement: element,
    dragOffset: { x: 0, y: 0 },
    startPosition: world,
    originalElement: JSON.parse(JSON.stringify(element.element)),
    rotationCenter: elementCenter,
    initialAngle: Math.atan2(world.y - elementCenter.y, world.x - elementCenter.x)
  });
}, [screenToWorld, elements, saveToHistory, setDragState, showErrorToast, getElementCenter]);

const rotateElement = useCallback((elementInfo, rotationAngle, center) => {
  const { element } = elementInfo;
  
  if (!element || !center) return element;
  
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);
  
  if (element.center) {
    // Waypoint - rotate around its own center (but waypoints don't really need rotation)
    return element;
  } else if (element.points && Array.isArray(element.points)) {
    // Polygon (exit, distribution, obstacle) - rotate around calculated center
    return {
      ...element,
      points: element.points.map(point => {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          return point; // Return original point if invalid
        }
        
        // Translate to origin
        const x = point.x - center.x;
        const y = point.y - center.y;
        
        // Rotate
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        
        // Translate back
        return {
          x: rotatedX + center.x,
          y: rotatedY + center.y
        };
      })
    };
  }
  
  return element; // Return original element if we can't rotate it
}, []);

const updateElementRotationPreview = useCallback((rotatedElement) => {
  const { type, element: originalElement } = dragState.draggedElement;
  
  const newElements = { ...elements };
  const elementArray = type === 'waypoint' ? newElements.waypoints : 
                      type === 'exit' ? newElements.exits : 
                      type === 'distribution' ? newElements.distributions :
                      type === 'obstacle' ? newElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === originalElement.id);
  if (index >= 0) {
    elementArray[index] = rotatedElement;
  }
  
  // Update journey connections for preview
  const updatedConnections = journeyConnections.map(connection => {
    let updatedConnection = { ...connection };
    
    if (connection.from?.element?.id === originalElement.id) {
      updatedConnection.from = {
        ...connection.from,
        element: rotatedElement
      };
    }
    
    if (connection.to?.element?.id === originalElement.id) {
      updatedConnection.to = {
        ...connection.to,
        element: rotatedElement
      };
    }
    
    if (connection.waypoints && (
      connection.fromId === originalElement.id || 
      connection.toId === originalElement.id
    )) {
      updatedConnection.waypoints = null;
    }
    
    return updatedConnection;
  });
  
  // Use direct state update for immediate preview (no history)
  onElementsChange && onElementsChange(newElements);
  onJourneyConnectionsChange && onJourneyConnectionsChange(updatedConnections);
}, [dragState, elements, journeyConnections, onElementsChange, onJourneyConnectionsChange]);

const handleRotateMouseMove = useCallback((e) => {
  if (!dragState.isDragging || !dragState.rotationCenter) return;
  
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const currentPos = screenToWorld(canvasX, canvasY);
  
  // Add null check for rotationCenter
  if (!dragState.rotationCenter || !currentPos) return;
  
  // Calculate current angle
  const currentAngle = Math.atan2(
    currentPos.y - dragState.rotationCenter.y, 
    currentPos.x - dragState.rotationCenter.x
  );
  
  // Calculate rotation angle (difference from initial angle)
  let rotationAngle = currentAngle - dragState.initialAngle;
  
  // Snap to 15-degree increments if Shift is held
  if (e.shiftKey) {
    const snapIncrement = Math.PI / 12; // 15 degrees
    rotationAngle = Math.round(rotationAngle / snapIncrement) * snapIncrement;
  }
  
  // Create rotated element
  const rotatedElement = rotateElement(
    dragState.draggedElement, 
    rotationAngle, 
    dragState.rotationCenter
  );
  
  // Update the element position in real-time for visual feedback
  updateElementRotationPreview(rotatedElement);
  
}, [dragState, screenToWorld, rotateElement, updateElementRotationPreview]);

const validateMove = useCallback((elementInfo) => {
  const { type, element } = elementInfo;
  const currentElements = { ...elements };
  
  console.log(`Validating move for ${type} element:`, element);
  
  // Update current elements with moved element
  const elementArray = type === 'waypoint' ? currentElements.waypoints : 
                      type === 'exit' ? currentElements.exits : 
                      type === 'distribution' ? currentElements.distributions :
                      type === 'obstacle' ? currentElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === element.id);
  if (index >= 0) {
    elementArray[index] = element;
  }
  
  // 1. Check if element is within walkable boundaries
  if (type !== 'boundary') {
    console.log('Checking boundary constraints...');
    const points = element.points || [element.center];
    const allPointsInside = points.every(point => 
      isPointInWalkableArea(point, currentElements.boundaries)
    );
    
    if (!allPointsInside) {
      console.log('FAILED: Element outside walkable boundaries');
      return {
        valid: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} must stay within walkable boundaries`
      };
    }
    console.log('PASSED: Boundary check');
  }
  
  // 2. Check for overlaps with same type
  if (type === 'exit' || type === 'distribution') {
    console.log('Checking same-type overlap constraints...');
    const sameTypeElements = currentElements[type === 'exit' ? 'exits' : 'distributions'];
    
    for (const otherElement of sameTypeElements) {
      if (otherElement.id === element.id) continue;
      
      const hasOverlap = element.points.some(point => 
        isPointInPolygon(point, otherElement.points)
      ) || otherElement.points.some(point => 
        isPointInPolygon(point, element.points)
      );
      
      if (hasOverlap) {
        console.log(`FAILED: ${type} overlaps with another ${type}`);
        return {
          valid: false,
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} cannot overlap with existing ${type}`
        };
      }
    }
    console.log('PASSED: Same-type overlap check');
  }
  
  // 3. Check waypoint-specific constraints
  if (type === 'waypoint') {
    console.log('Checking waypoint-specific constraints...');
    const allPolygons = [
      ...currentElements.exits,
      ...currentElements.distributions,
      ...(currentElements.obstacles || [])
    ];
    
    for (const polygon of allPolygons) {
      if (isPointInPolygon(element.center, polygon.points)) {
        console.log('FAILED: Waypoint inside another element');
        return {
          valid: false,
          message: 'Waypoint cannot be placed inside other elements'
        };
      }
    }
    console.log('PASSED: Waypoint constraint check');
  }
  
  // 4. Check obstacle-specific constraints
  if (type === 'obstacle') {
    console.log('Checking obstacle-specific constraints...');
    const otherObstacles = (currentElements.obstacles || []).filter(obs => obs.id !== element.id);
    
    for (const otherObstacle of otherObstacles) {
      const hasOverlap = element.points.some(point => 
        isPointInPolygon(point, otherObstacle.points)
      ) || otherObstacle.points.some(point => 
        isPointInPolygon(point, element.points)
      );
      
      if (hasOverlap) {
        console.log('FAILED: Obstacle overlaps with another obstacle');
        return {
          valid: false,
          message: 'Obstacle cannot overlap with existing obstacles'
        };
      }
    }
    
    // const criticalElements = [...currentElements.exits, ...currentElements.distributions];
    
    // for (const criticalElement of criticalElements) {
    //   const hasOverlap = element.points.some(point => 
    //     isPointInPolygon(point, criticalElement.points)
    //   ) || criticalElement.points.some(point => 
    //     isPointInPolygon(point, element.points)
    //   );
      
    //   if (hasOverlap) {
    //     console.log('FAILED: Obstacle overlaps with exit/distribution');
    //     return {
    //       valid: false,
    //       message: 'Obstacle cannot overlap with exits or start areas'
    //     };
    //   }
    // }
    console.log('PASSED: Obstacle constraint check');
  }
  
  console.log('ALL VALIDATION PASSED');
  return { valid: true };
}, [elements, isPointInWalkableArea, isPointInPolygon]);
const validateRotation = useCallback((elementInfo) => {
  const { type, element } = elementInfo;
  const currentElements = { ...elements };
  
  // Update current elements with rotated element
  const elementArray = type === 'waypoint' ? currentElements.waypoints : 
                      type === 'exit' ? currentElements.exits : 
                      type === 'distribution' ? currentElements.distributions :
                      type === 'obstacle' ? currentElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === element.id);
  if (index >= 0) {
    elementArray[index] = element;
  }
  
  // Same validation logic as move (check boundaries, overlaps, etc.)
  return validateMove(elementInfo);
}, [elements, validateMove]);

const handleWaypointRadiusAdjust = useCallback((e) => {
  if (drawingMode !== 'select' || !e.ctrlKey) return;
  
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const world = screenToWorld(canvasX, canvasY);
  
  const element = findElementAtPoint(world, elements);
  if (element && element.type === 'waypoint') {
    const waypoint = element.element;
    const center = worldToScreen(waypoint.center.x, waypoint.center.y);
    const distance = Math.sqrt(
      Math.pow(canvasX - center.x, 2) + Math.pow(canvasY - center.y, 2)
    );
    
    // Check if near the edge of the waypoint
    const currentRadius = waypoint.radius * zoom;
    if (Math.abs(distance - currentRadius) < 10) {
      saveToHistory && saveToHistory();
      
      const newRadius = Math.max(5, Math.min(100, distance / zoom));
      const newElements = { ...elements };
      const waypointIndex = newElements.waypoints.findIndex(w => w.id === waypoint.id);
      if (waypointIndex >= 0) {
        newElements.waypoints[waypointIndex] = {
          ...newElements.waypoints[waypointIndex],
          radius: newRadius
        };
      }
      onElementsChange && onElementsChange(newElements);
    }
  }
}, [drawingMode, screenToWorld, worldToScreen, elements, zoom, saveToHistory, onElementsChange]);

const handleWaypointRadiusEdit = useCallback((waypointId) => {
  if (editingWaypoint === waypointId) {
    setEditingWaypoint(null);
  } else {
    setEditingWaypoint(waypointId);
  }
}, [editingWaypoint, setEditingWaypoint]);

const handleMouseDown = useCallback((e) => {
  if (isSimulationMode) return;
  
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const world = screenToWorld(canvasX, canvasY);

  if (e.button === 1 || e.ctrlKey || e.shiftKey || e.spaceKey ) {
    setIsPanning(true);
    setLastPanPoint({ x: e.clientX, y: e.clientY });
    return;
  }

  if (e.button !== 0) {
    return; // Exit early for right-click or other buttons
  }
  
  if (drawingMode === 'delete') {
    const deleted = deleteElementOrVertex(world);
    return;
  }

  if (drawingMode === 'select') {
    const element = findElementAtPoint(world, elements);
    if (element && element.type === 'waypoint') {
      const waypoint = element.element;
      const center = worldToScreen(waypoint.center.x, waypoint.center.y);
      const radiusInPixels = waypoint.radius * zoom;
      const distanceFromCenter = Math.sqrt(
        Math.pow(canvasX - center.x, 2) + Math.pow(canvasY - center.y, 2)
      );
      
      // Check if clicking near the edge (for radius dragging)
      if (editingWaypoint === waypoint.id && Math.abs(distanceFromCenter - radiusInPixels) < 15) {
        setIsDraggingRadius(true);
        saveToHistory && saveToHistory();
        return;
      }
      
      // Regular waypoint click to enable/disable editing
      if (Math.abs(distanceFromCenter - radiusInPixels) < 15 || distanceFromCenter < radiusInPixels) {
        handleWaypointRadiusEdit(waypoint.id);
        return;
      }
    } else {
      // Clicked outside waypoint, disable editing
      setEditingWaypoint(null);
    }
  }

  const vertex = findVertexAtPoint(world, elements, zoom, activeBoundary);
 
  if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && vertex && vertex.type === 'openBoundary') {
    const openBoundary = elements.openBoundaries[vertex.elementIndex];
    if (openBoundary.type === (drawingMode === 'obstacle' ? 'obstacle' : 'boundary')) {
      loadOpenBoundaryForContinuation(openBoundary, vertex.pointIndex);
      const newElements = { ...elements };
      newElements.openBoundaries = newElements.openBoundaries.filter(
        (_, index) => index !== vertex.elementIndex
      );
      onElementsChange && onElementsChange(newElements);
      return;
    }
  }
  
  // Skip vertex handling for waypoints when in journey mode
  if (vertex && !(drawingMode === 'journey' && vertex.type === 'waypoint')) {
    if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && vertex.type === 'activeBoundary') {
      if (showPreviewLine && lastConnectedPoint !== null && vertex.pointIndex !== lastConnectedPoint) {
        const newConnection = { from: lastConnectedPoint, to: vertex.pointIndex };
        const updatedConnections = [...connections, newConnection];
        
        setConnections(updatedConnections);
        
        if (isPolygonClosed(activeBoundary, updatedConnections)) {
          completeBoundary(updatedConnections);
          return;
        }
        
        setLastConnectedPoint(vertex.pointIndex);
        setShowPreviewLine(true);
        return;
      } else if (!showPreviewLine) {
        setLastConnectedPoint(vertex.pointIndex);
        setShowPreviewLine(true);
        return;
      } else if (showPreviewLine && vertex.pointIndex === lastConnectedPoint) {
        return;
      }
    } else if (drawingMode !== 'walkablearea' && drawingMode !== 'obstacle' && drawingMode !== 'delete') {
      const originalElement = JSON.parse(JSON.stringify(elements));
      setOriginalVertexState(originalElement);

      setIsDraggingVertex(true);
      setDraggedVertex(vertex);
      return;
    }
  }
  
  // Handle journey mode early to prevent other interactions
  if (drawingMode === 'journey') {
    // First, check if we clicked on an existing connection to assign it to a journey
    const clickedConnection = journeyConnections.find(conn => {
      const fromElement = conn.from?.element || conn.from;
      const toElement = conn.to?.element || conn.to;
      
      if (fromElement && toElement) {
        const fromCenter = getElementCenter(fromElement);
        const toCenter = getElementCenter(toElement);
        
        if (fromCenter && toCenter) {
          // Convert centers to world coordinates for comparison
          const fromWorld = screenToWorld ? screenToWorld(fromCenter) : fromCenter;
          const toWorld = screenToWorld ? screenToWorld(toCenter) : toCenter;
          
          // Check if click is near the line between centers
          const distance = distanceToLine(world, fromWorld, toWorld);
          return distance < (10 / zoom); // Scale tolerance with zoom
        }
      }
      return false;
    });
    
    // In the section where you click on existing connections to assign them
    if (clickedConnection) {
      // Get selected journey from JourneyAssignmentTool
      const journeyTool = document.querySelector('[data-selected-journey]');
      const selectedJourney = journeyTool?.getAttribute('data-selected-journey') || 'J1';
      const journeyColor = journeyTool?.getAttribute('data-journey-color') || '#3b82f6';
      
      if (selectedJourney) {
        // Create temporary connection with new journey assignment for validation
        const tempConnection = {
          ...clickedConnection,
          journeyId: selectedJourney,
          journeyColor: journeyColor,
          fromId: clickedConnection.from?.element?.id || clickedConnection.fromId,
          toId: clickedConnection.to?.element?.id || clickedConnection.toId
        };
        
        // Remove the old connection from validation check
        const connectionsWithoutCurrent = journeyConnections.filter(conn => conn !== clickedConnection);
        
        // Validate the journey assignment
        const validation = validateJourneyStartAreas(tempConnection, connectionsWithoutCurrent);
        
        if (!validation.valid) {
          showErrorToast && showErrorToast(validation.message);
          setSnapGuide(null);
          return;
        }
        
        // If validation passes, update the connection's journey assignment
        const from = clickedConnection.from?.element || clickedConnection.from;
        if (from && from.type === 'distribution') {
          const distributionSetId = getDistributionSet && getDistributionSet(clickedConnection.fromId);
          
          if (distributionSetId) {
            // Update all connections from distributions in this set
            const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
            const setDistributionIds = setDistributions.map(d => d.id);
            
            const updatedConnections = journeyConnections.map(conn => {
              if (setDistributionIds.includes(conn.fromId)) {
                return {
                  ...conn,
                  journeyId: selectedJourney,
                  journeyColor: journeyColor,
                  fromId: conn.from?.element?.id || conn.fromId,
                  toId: conn.to?.element?.id || conn.toId
                };
              }
              return conn;
            });
            
            onJourneyConnectionsChange && onJourneyConnectionsChange(updatedConnections);
            showErrorToast && showErrorToast(`All connections in set assigned to ${selectedJourney}`);
          } else {
            // Original single connection logic
            const updatedConnections = journeyConnections.map(conn => 
              conn === clickedConnection 
                ? { 
                    ...conn, 
                    journeyId: selectedJourney,
                    journeyColor: journeyColor,
                    fromId: conn.from?.element?.id || conn.fromId,
                    toId: conn.to?.element?.id || conn.toId
                  }
                : conn
            );
            onJourneyConnectionsChange && onJourneyConnectionsChange(updatedConnections);
            showErrorToast && showErrorToast(`Connection assigned to ${selectedJourney}`);
          }
        } else {
          // Original logic for non-distribution connections
          const updatedConnections = journeyConnections.map(conn => 
            conn === clickedConnection 
              ? { 
                  ...conn, 
                  journeyId: selectedJourney,
                  journeyColor: journeyColor,
                  fromId: conn.from?.element?.id || conn.fromId,
                  toId: conn.to?.element?.id || conn.toId
                }
              : conn
          );
          onJourneyConnectionsChange && onJourneyConnectionsChange(updatedConnections);
          showErrorToast && showErrorToast(`Connection assigned to ${selectedJourney}`);
        }
      }
      setSnapGuide(null);
      return;
    }
    
    // If no connection was clicked, handle element selection for creating new connections
    const clickedElement = findElementAtPoint(world, elements);
    if (clickedElement && clickedElement.type !== 'obstacle') {
      const isAlreadySelected = selectedElements.some(sel => 
        (sel.element?.id || sel.id) === (clickedElement.element?.id || clickedElement.id)
      );
      
      if (isAlreadySelected) {
        // Deselect the element
        const newSelection = selectedElements.filter(sel => 
          (sel.element?.id || sel.id) !== (clickedElement.element?.id || clickedElement.id)
        );
        setSelectedElements(newSelection);
      } else {
        // Select the element
        const newSelection = [...selectedElements, clickedElement];
        setSelectedElements(newSelection);
        
        // If we have 2 selected elements, create a connection
        if (newSelection.length === 2) {
          const [from, to] = newSelection;
          
          // Get element IDs for comparison
          const fromId = from.element?.id || from.id;
          const toId = to.element?.id || to.id;

          if (from.type === 'exit') {
            showErrorToast && showErrorToast('Cannot create journey from an exit. Exits are destinations only.');
            setSelectedElements([]);
            return;
          }
          
          if (to.type === 'distribution') {
            showErrorToast && showErrorToast('Cannot create journey to a start area. Start areas are sources only.');
            setSelectedElements([]);
            return;
          }
          
          let selectedJourney;
          let journeyColor;
          
          if (from.type === 'distribution') {
            // Check if this distribution already has a journey
            const existingConnectionFromDistribution = journeyConnections.find(conn => 
              conn.fromId === fromId
            );
            
            if (existingConnectionFromDistribution) {
              // Use existing journey for this distribution
              selectedJourney = existingConnectionFromDistribution.journeyId;
              journeyColor = existingConnectionFromDistribution.journeyColor;
            } else {
              // Auto-create new journey for this distribution
              const journeyTool = document.querySelector('[data-selected-journey]');
              const currentSelectedJourney = journeyTool?.getAttribute('data-selected-journey') || 'J1';
              
              // Check if current journey is already used by another distribution
              const currentJourneyUsedByOtherDistribution = journeyConnections.some(conn => {
                const connFromElement = [...elements.distributions].find(el => el.id === conn.fromId);
                return connFromElement && conn.journeyId === currentSelectedJourney;
              });
              
              if (currentJourneyUsedByOtherDistribution) {
                // Generate new journey ID
                const existingJourneyIds = [...new Set(journeyConnections.map(conn => conn.journeyId))];
                let maxNumber = 0;
                existingJourneyIds.forEach(journeyId => {
                  const match = journeyId.match(/^J(\d+)$/);
                  if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNumber) {
                      maxNumber = num;
                    }
                  }
                });
                selectedJourney = `J${maxNumber + 1}`;
                
                // Update the journey assignment tool
                onSelectedJourneyChange && onSelectedJourneyChange(selectedJourney);
                showErrorToast && showErrorToast(`Auto-created ${selectedJourney} for this distribution`);
              } else {
                selectedJourney = currentSelectedJourney;
              }
              
              // Get color for journey
              const colors = [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
                '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280',
                '#22d3ee', '#eab308', '#a855f7', '#f43f5e', '#14b8a6',
                '#d946ef', '#4ade80', '#0ea5e9', '#facc15', '#fda4af',
                '#93c5fd', '#fb923c', '#2dd4bf', '#fde047', '#c084fc',
                '#fcd34d', '#34d399', '#f87171', '#60a5fa', '#bbf7d0'
              ];
              const match = selectedJourney.match(/^J(\d+)$/);
              const journeyNumber = match ? parseInt(match[1]) - 1 : 0;
              journeyColor = colors[journeyNumber % colors.length];
            }
          } else {
            // Not from distribution, use currently selected journey
            const journeyTool = document.querySelector('[data-selected-journey]');
            selectedJourney = journeyTool?.getAttribute('data-selected-journey') || 'J1';
            journeyColor = journeyTool?.getAttribute('data-journey-color') || '#3b82f6';
          }

          const connectionExistsForThisJourney = journeyConnections.some(conn => {
            const connFromId = conn.from?.element?.id || conn.fromId || conn.from?.id;
            const connToId = conn.to?.element?.id || conn.toId || conn.to?.id;
            const connJourneyId = conn.journeyId;
            
            return (connFromId === fromId && connToId === toId && connJourneyId === selectedJourney);
          });
          
          if (connectionExistsForThisJourney) {
            showErrorToast && showErrorToast(`Connection already exists for ${selectedJourney}`);
            setSelectedElements([]);
            return;
          }
          
          // Create temporary connection for validation
          const tempConnection = { 
            from, 
            to, 
            id: `connection_${Date.now()}`,
            journeyId: selectedJourney,
            journeyColor: journeyColor,
            fromId: fromId,
            toId: toId
          };
          
          // Validate journey start areas
          const validation = validateJourneyStartAreas(tempConnection, journeyConnections);
          
          if (!validation.valid) {
            showErrorToast && showErrorToast(validation.message);
            setSelectedElements([]);
            return;
          }
          
          // If validation passes, create the connection
          const cleanedConnections = journeyConnections.filter(conn => 
            !(conn.fromId === fromId && conn.journeyId === 'AUTO_J1')
          );

          // Handle set distributions
          if (from.type === 'distribution') {
            const distributionSetId = getDistributionSet && getDistributionSet(fromId);
            
            if (distributionSetId) {
              // Create connections for all distributions in the set
              const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
              const setConnections = [];
              
              setDistributions.forEach(dist => {
                if (dist.id !== fromId) { // Don't duplicate the main connection
                  const setConnection = {
                    from: { type: 'distribution', element: dist },
                    to,
                    id: `connection_${Date.now()}_${dist.id}`,
                    journeyId: selectedJourney,
                    journeyColor: journeyColor,
                    fromId: dist.id,
                    toId: toId
                  };
                  setConnections.push(setConnection);
                }
              });
              
              // Add all set connections
              const newConnections = [...cleanedConnections, tempConnection, ...setConnections];
              onJourneyConnectionsChange && onJourneyConnectionsChange(newConnections);
              
              showErrorToast && showErrorToast(`Connections created for ${selectedJourney} (${setDistributions.length} distributions in set)`);
            } else {
              // Original single distribution logic
              const newConnections = [...cleanedConnections, tempConnection];
              onJourneyConnectionsChange && onJourneyConnectionsChange(newConnections);
              showErrorToast && showErrorToast(`Connection created for ${selectedJourney}`);
            }
          } else {
            // Non-distribution connection
            const newConnections = [...cleanedConnections, tempConnection];
            onJourneyConnectionsChange && onJourneyConnectionsChange(newConnections);
            showErrorToast && showErrorToast(`Connection created for ${selectedJourney}`);
          }
          setSelectedElements([]);
        }
      }
    }
    setSnapGuide(null);
    return; // Exit early for journey mode
  }

  if (drawingMode === 'walkablearea' || drawingMode === 'obstacle') {
    if (drawingMode === 'walkablearea' && elements.boundaries.length > 0 && activeBoundary.length === 0) {
      showErrorToast('Only one walkable area is allowed. Delete the existing boundary to draw a new one.');
      return; // Prevent any boundary drawing
    }
    const snapVertex = findSnapVertex(world, activeBoundary, zoom);
    if (snapVertex && lastConnectedPoint !== null) {
      if (snapVertex.pointIndex !== lastConnectedPoint) {
        const newConnection = { from: lastConnectedPoint, to: snapVertex.pointIndex };
        const updatedConnections = [...connections, newConnection];
        setConnections(updatedConnections);
        if (isPolygonClosed(activeBoundary, updatedConnections)) {
          completeBoundary(updatedConnections);
          return;
        }
        setLastConnectedPoint(snapVertex.pointIndex);
        setShowPreviewLine(true);
      }
    } else if (snapVertex && lastConnectedPoint === null) {
      setLastConnectedPoint(snapVertex.pointIndex);
      setShowPreviewLine(true);
    } else if (!snapVertex && !vertex) {
  // Apply snapping for first click if currentSnappedPoint is null
  let finalPoint = currentSnappedPoint;
  
  if (!finalPoint) {
    // First click - apply grid snapping manually
    finalPoint = world;
    const gridSnapped = snapToGrid(world, zoom);
    if (gridSnapped.snapped) {
      finalPoint = { x: gridSnapped.x, y: gridSnapped.y };
    }
  }
      
      if (drawingMode === 'obstacle' && !isPointInWalkableArea(finalPoint, elements.boundaries)) {
        showErrorToast('Obstacle points must be placed within walkable boundaries');
        return;
      }
      if (drawingMode === 'obstacle' && isPointInExistingObstacle(finalPoint, elements.obstacles)) {
        showErrorToast('Cannot place obstacle points inside existing obstacles');
        return;
      }
      const newPointIndex = activeBoundary.length;
      setActiveBoundary(prev => [...prev, finalPoint]);
      if (lastConnectedPoint !== null) {
        const newConnection = { from: lastConnectedPoint, to: newPointIndex };
        setConnections(prev => [...prev, newConnection]);
      }
      setLastConnectedPoint(newPointIndex);
      setShowPreviewLine(true);
    }
  } else if (drawingMode === 'exit' || drawingMode === 'distribution') {
    setIsDragging(true);
    setDragStart(world);
    setDragCurrent(world);
  } else if (drawingMode === 'waypoint') {
    if (!isPointInWalkableArea(world, elements.boundaries)) {
      showErrorToast('Waypoint must be placed within walkable boundaries');
      return;
    }
    const waypoint = { id: `waypoint_${Date.now()}`, center: world, radius: 23.0 };
    const newElements = { ...elements, waypoints: [...elements.waypoints, waypoint] };
    onElementsChange && onElementsChange(newElements);
  }

  setSnapGuide(null);
}, [
  isSimulationMode, screenToWorld, elements, zoom, activeBoundary, drawingMode, showPreviewLine, 
  lastConnectedPoint, connections, completeBoundary, selectedElements, 
  journeyConnections, onElementsChange, onJourneyConnectionsChange, onSelectedJourneyChange,
  loadOpenBoundaryForContinuation, deleteElementOrVertex, snapGuide, isPointInExistingObstacle, 
  showErrorToast, getDistributionSet, getDistributionsInSet, currentSnappedPoint,editingWaypoint, setEditingWaypoint, setIsDraggingRadius, handleWaypointRadiusEdit
]);
        
      
        const handleMouseMove = useCallback((e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  
  // Use functional update to avoid dependency on mousePosition
  setMousePosition(prev => {
    const newPos = { x: canvasX, y: canvasY };
    // Only update if position actually changed to reduce renders
    if (prev.x === newPos.x && prev.y === newPos.y) {
      return prev;
    }
    return newPos;
  });
  
  const world = screenToWorld(canvasX, canvasY);

  
  // Distribution hover logic
  if (!isDragging && !isPanning && !isDraggingVertex && !isSimulationMode && 
      drawingMode !== 'walkablearea' && drawingMode !== 'obstacle') {
    
    const element = findElementAtPoint(world, elements);
    
    if (element && element.type === 'distribution') {
      setHoveredDistribution(element.element);
      
      let tooltipX = canvasX + 15;
      let tooltipY = canvasY - 10;
      
      if (tooltipX + 200 > canvasSize.width) {
        tooltipX = canvasX - 215;
      }
      
      if (tooltipY < 0) {
        tooltipY = canvasY + 25;
      }
      setDistributionTooltipPosition({ x: tooltipX, y: tooltipY });
    } else {
      setHoveredDistribution(null);
    }
  } else {
    setHoveredDistribution(null);
  }
  
  // Preview line logic for boundary drawing WITH GRID SNAPPING
  // Preview line logic for boundary drawing WITH GRID SNAPPING
if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && showPreviewLine && !isSimulationMode) {
  const snapVertex = findSnapVertex(world, activeBoundary, zoom);
  setHoveredSnapVertex(snapVertex);

  let currentSnapGuide = null;

  if (snapVertex) {
    setPreviewPoint(snapVertex.point);
    setCurrentSnappedPoint(snapVertex.point); // Store snapped point
  } else {
    // GRID SNAPPING LOGIC
    let snappedPoint = world;
    
    // Apply grid snapping first
    const gridSnapped = snapToGrid(world, zoom);
    if (gridSnapped.snapped) {
      snappedPoint = { x: gridSnapped.x, y: gridSnapped.y };
    }
    
    // Apply angle snapping from last connected point
    if (lastConnectedPoint !== null && activeBoundary[lastConnectedPoint]) {
      const fromPoint = activeBoundary[lastConnectedPoint];
      const angleSnapped = snapToAngle(fromPoint, snappedPoint, zoom);
      if (angleSnapped.snapped) {
        snappedPoint = angleSnapped.point;
        
        // Set snap guide for visual feedback
        currentSnapGuide = {
          type: angleSnapped.snapType,
          guideLine: {
            start: fromPoint,
            end: snappedPoint
          },
          snapAngle: angleSnapped.snapAngle
        };
      }
    }
    
    setPreviewPoint(snappedPoint);
    setCurrentSnappedPoint(snappedPoint); // Store the snapped point for click handler
    setSnapGuide(currentSnapGuide);
  }
} else {
  // Clear snapped point when not in boundary drawing mode
  setCurrentSnappedPoint(null);
}
  
  // Vertex dragging
  if (isDraggingVertex && draggedVertex && !isSimulationMode) {
    // Apply grid snapping to vertex dragging too
    let dragPosition = world;
    
    // Grid snap for vertex dragging when zoomed in enough
    const gridSnapped = snapToGrid(world, zoom);
    if (gridSnapped.snapped) {
      dragPosition = { x: gridSnapped.x, y: gridSnapped.y };
    }
    
    updateVertexPosition(draggedVertex, dragPosition);
    return;
  }
  
  // Vertex hovering
  if (!isDragging && !isPanning && !isDraggingVertex && !isSimulationMode && 
      ((drawingMode !== 'walkablearea' && drawingMode !== 'obstacle') || !showPreviewLine)) {
    const vertex = findVertexAtPoint(world, elements, zoom, activeBoundary);
    setHoveredVertex(vertex);
  }
  
  // Panning logic
  if (isPanning) {
    const deltaX = e.clientX - lastPanPoint.x;
    const deltaY = e.clientY - lastPanPoint.y;
    setViewOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    setLastPanPoint({ x: e.clientX, y: e.clientY });
    return;
  }
  
  // Dragging rectangles
  if (isDragging && (drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'obstacle') && !isSimulationMode) {
    setDragCurrent(world);
  }

  if (isDraggingRadius && editingWaypoint) {
    const waypoint = elements.waypoints.find(w => w.id === editingWaypoint);
    if (waypoint) {
      const center = worldToScreen(waypoint.center.x, waypoint.center.y);
      const distance = Math.sqrt(
        Math.pow(canvasX - center.x, 2) + Math.pow(canvasY - center.y, 2)
      );
      
      const newRadius = Math.max(5, Math.min(100, distance / zoom));
      
      const newElements = { ...elements };
      const waypointIndex = newElements.waypoints.findIndex(w => w.id === waypoint.id);
      if (waypointIndex >= 0) {
        newElements.waypoints[waypointIndex] = {
          ...newElements.waypoints[waypointIndex],
          radius: newRadius
        };
      }
      onElementsChange && onElementsChange(newElements);
    }
    return;
  }

  if (!isDragging && !isPanning && !isDraggingVertex && !isSimulationMode && 
      drawingMode !== 'walkablearea' && drawingMode !== 'obstacle') {

    const element = findElementAtPoint(world, elements);
    
    // Handle waypoint hover
    if (element && element.type === 'waypoint') {
      setHoveredWaypoint(element.element);
      
      let tooltipX = canvasX + 15;
      let tooltipY = canvasY - 10;
      
      if (tooltipX + 200 > canvasSize.width) {
        tooltipX = canvasX - 215;
      }
      
      if (tooltipY < 0) {
        tooltipY = canvasY + 25;
      }
      setWaypointTooltipPosition({ x: tooltipX, y: tooltipY });
    } else {
      setHoveredWaypoint(null);
    }
    
    // Handle exit hover
    if (element && element.type === 'exit') {
      setHoveredExit(element.element);
      
      let tooltipX = canvasX + 15;
      let tooltipY = canvasY - 10;
      
      if (tooltipX + 200 > canvasSize.width) {
        tooltipX = canvasX - 215;
      }
      
      if (tooltipY < 0) {
        tooltipY = canvasY + 25;
      }
      setExitTooltipPosition({ x: tooltipX, y: tooltipY });
    } else {
      setHoveredExit(null);
    }
    
  } else {
    setHoveredWaypoint(null);
    setHoveredExit(null);
  }
}, [
  screenToWorld,
  drawingMode,
  showPreviewLine,
  zoom,
  isDraggingVertex,
  draggedVertex,
  isPanning,
  isSimulationMode,
  canvasSize.width,
  isDragging,
  activeBoundary, // ADD THIS
  lastConnectedPoint, // ADD THIS
  elements, // ADD THIS
  setSnapGuide, // ADD THIS
  editingWaypoint,
  isDraggingRadius,
  
]);

const validateVertexPosition = useCallback((newElements) => {
  // Validate exits don't overlap
  for (let i = 0; i < newElements.exits.length; i++) {
    for (let j = i + 1; j < newElements.exits.length; j++) {
      const exit1 = newElements.exits[i];
      const exit2 = newElements.exits[j];
      
      const hasOverlap = exit1.points.some(point => 
        isPointInPolygon(point, exit2.points)
      ) || exit2.points.some(point => 
        isPointInPolygon(point, exit1.points)
      );
      
      if (hasOverlap) {
        return {
          valid: false,
          message: `Exit ${i + 1} overlaps with Exit ${j + 1}`
        };
      }
    }
  }
  
  // Validate distributions don't overlap
  for (let i = 0; i < newElements.distributions.length; i++) {
    for (let j = i + 1; j < newElements.distributions.length; j++) {
      const dist1 = newElements.distributions[i];
      const dist2 = newElements.distributions[j];
      
      const hasOverlap = dist1.points.some(point => 
        isPointInPolygon(point, dist2.points)
      ) || dist2.points.some(point => 
        isPointInPolygon(point, dist1.points)
      );
      
      if (hasOverlap) {
        return {
          valid: false,
          message: `Distribution ${i + 1} overlaps with Distribution ${j + 1}`
        };
      }
    }
  }
  
  // Validate obstacles don't overlap
  if (newElements.obstacles) {
    for (let i = 0; i < newElements.obstacles.length; i++) {
      for (let j = i + 1; j < newElements.obstacles.length; j++) {
        const obs1 = newElements.obstacles[i];
        const obs2 = newElements.obstacles[j];
        
        const hasOverlap = obs1.points.some(point => 
          isPointInPolygon(point, obs2.points)
        ) || obs2.points.some(point => 
          isPointInPolygon(point, obs1.points)
        );
        
        if (hasOverlap) {
          return {
            valid: false,
            message: `Obstacle ${i + 1} overlaps with Obstacle ${j + 1}`
          };
        }
      }
    }
  }
  
  return { valid: true };
}, [isPointInPolygon]);
      
const handleMouseUp = useCallback((e) => {
          if (isSimulationMode) return;
          
          if (isDraggingRadius) {
            setIsDraggingRadius(false);
            return;
          }

          if (isDraggingVertex) {
            const validation = validateVertexPosition(elements);
    
    if (!validation.valid) {
      // Rollback to original state
      if (originalVertexState) {
        onElementsChange && onElementsChange(originalVertexState);
        showErrorToast && showErrorToast(validation.message);
      }
    }
            setIsDraggingVertex(false);
            setDraggedVertex(null);
            setOriginalVertexState(null);
            return;
          }
          
          if (isPanning) {
            setIsPanning(false);
            return;
          }
          
          if (isDragging && (drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'obstacle')) {
            if (dragStart && dragCurrent) {
              const minX = Math.min(dragStart.x, dragCurrent.x);
              const maxX = Math.max(dragStart.x, dragCurrent.x);
              const minY = Math.min(dragStart.y, dragCurrent.y);
              const maxY = Math.max(dragStart.y, dragCurrent.y);
              
              const rectanglePoints = [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
              ];
              
              if ((drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'obstacle') && 
                  !isRectangleInWalkableArea(rectanglePoints, elements.boundaries)) {
                showErrorToast(`${drawingMode} areas must be placed entirely within walkable boundaries`);
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
                return;
              }
      
              if (!meetsMinimumArea(rectanglePoints, 0.1)) { 
                showErrorToast("Area too small - polygon not created");
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
                return;
      }
      
              if (drawingMode === 'exit' || drawingMode === 'distribution') {
        const elementType = drawingMode === 'exit' ? 'exits' : 'distributions';
        if (isPolygonOverlappingWithSameType(rectanglePoints, elements, elementType)) {
          showErrorToast(`${drawingMode} cannot overlap with existing ${drawingMode}`);
      
          setIsDragging(false);
          setDragStart(null);
          setDragCurrent(null);
          return;
        }
      }
              
              const rectangle = {
                id: `${drawingMode}_${Date.now()}`,
                points: rectanglePoints
              };
              
              if (drawingMode === 'distribution') {
                rectangle.parameters = { number: 10, radius: 0.2, v0: 1.3 };
              }
              
              const newElements = { ...elements };
              if (drawingMode === 'obstacle') {
                if (!newElements.obstacles) newElements.obstacles = [];
                newElements.obstacles.push(rectangle);
              } else {
                const arrayName = drawingMode === 'exit' ? 'exits' : 'distributions';
                newElements[arrayName] = [...elements[arrayName], rectangle];
              }
              onElementsChange && onElementsChange(newElements);
            }
            setIsDragging(false);
            setDragStart(null);
            setDragCurrent(null);
          }
        }, [isSimulationMode, isPanning, isDragging, isDraggingVertex, drawingMode, dragStart, dragCurrent, elements, onElementsChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }
  }, [canvasRef, handleWheel]);

 const handleElementHighlight = useCallback((elementToHighlight) => {
  // This function will be called from the sidebar
  // You can add any additional logic here if needed
  return elementToHighlight;
}, []); 

const handleMoveMouseDown = useCallback((e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const world = screenToWorld(canvasX, canvasY);
  
  const element = findElementAtPoint(world, elements);
  if (!element) return;
  
  // Don't allow moving boundaries (but allow obstacles now)
  if (element.type === 'boundary') {
    showErrorToast && showErrorToast('Boundaries cannot be moved');
    return;
  }
  
  saveToHistory && saveToHistory();
  
  setDragState({
    isDragging: true,
    draggedElement: element,
    dragOffset: { x: 0, y: 0 },
    startPosition: world,
    originalElement: JSON.parse(JSON.stringify(element.element)) // Store original for rollback
  });
}, [screenToWorld, elements, saveToHistory, setDragState, showErrorToast]);
// Helper function to move an element
const moveElement = useCallback((elementInfo, deltaX, deltaY) => {
  const { element } = elementInfo;
  
  if (element.center) {
    // Waypoint
    return {
      ...element,
      center: {
        x: element.center.x + deltaX,
        y: element.center.y + deltaY
      }
    };
  } else {
    // Polygon (exit, distribution)
    return {
      ...element,
      points: element.points.map(point => ({
        x: point.x + deltaX,
        y: point.y + deltaY
      }))
    };
  }
}, []);
const updateElementPositionPreview = useCallback((movedElement) => {
  const { type, element: originalElement } = dragState.draggedElement;
  
  const newElements = { ...elements };
  const elementArray = type === 'waypoint' ? newElements.waypoints : 
                      type === 'exit' ? newElements.exits : 
                      type === 'distribution' ? newElements.distributions :
                      type === 'obstacle' ? newElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === originalElement.id);
  if (index >= 0) {
    elementArray[index] = movedElement;
  }
  
  // Update journey connections for preview
  const updatedConnections = journeyConnections.map(connection => {
    let updatedConnection = { ...connection };
    
    if (connection.from?.element?.id === originalElement.id) {
      updatedConnection.from = {
        ...connection.from,
        element: movedElement
      };
    }
    
    if (connection.to?.element?.id === originalElement.id) {
      updatedConnection.to = {
        ...connection.to,
        element: movedElement
      };
    }
    
    if (connection.waypoints && (
      connection.fromId === originalElement.id || 
      connection.toId === originalElement.id
    )) {
      updatedConnection.waypoints = null;
    }
    
    return updatedConnection;
  });
  
  // Use direct state update for immediate preview (no history)
  onElementsChange && onElementsChange(newElements);
  onJourneyConnectionsChange && onJourneyConnectionsChange(updatedConnections);
}, [dragState, elements, journeyConnections, onElementsChange, onJourneyConnectionsChange]);
const handleMoveMouseMove = useCallback((e) => {
  if (!dragState.isDragging) return;
  
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const currentPos = screenToWorld(canvasX, canvasY);
  
  const deltaX = currentPos.x - dragState.startPosition.x;
  const deltaY = currentPos.y - dragState.startPosition.y;
  
  // Create moved element and update state immediately for preview
  const movedElement = moveElement(dragState.draggedElement, deltaX, deltaY);
  
  // Update the element position in real-time for visual feedback
  updateElementPositionPreview(movedElement);
  
}, [dragState, screenToWorld]);

// Helper function to update element position in state
const updateElementPosition = useCallback((movedElement) => {
  const { type, element: originalElement } = dragState.draggedElement;
  
  const newElements = { ...elements };
  const elementArray = type === 'waypoint' ? newElements.waypoints : 
                      type === 'exit' ? newElements.exits : 
                      type === 'distribution' ? newElements.distributions :
                      type === 'obstacle' ? newElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === originalElement.id);
  if (index >= 0) {
    elementArray[index] = movedElement;
  }
  
  // Update journey connections that reference this element
  const updatedConnections = journeyConnections.map(connection => {
    let updatedConnection = { ...connection };
    
    // Update 'from' element if it matches
    if (connection.from?.element?.id === originalElement.id) {
      updatedConnection.from = {
        ...connection.from,
        element: movedElement
      };
    }
    
    // Update 'to' element if it matches
    if (connection.to?.element?.id === originalElement.id) {
      updatedConnection.to = {
        ...connection.to,
        element: movedElement
      };
    }
    
    // Clear shortest path waypoints if this element was moved
    if (connection.waypoints && (
      connection.fromId === originalElement.id || 
      connection.toId === originalElement.id
    )) {
      updatedConnection.waypoints = null;
    }
    
    return updatedConnection;
  });
  
  updateElementsWithHistory && updateElementsWithHistory(newElements);
  updateJourneyConnectionsWithHistory && updateJourneyConnectionsWithHistory(updatedConnections);
}, [elements, journeyConnections, updateElementsWithHistory, updateJourneyConnectionsWithHistory, dragState.draggedElement]);

// Add this function to finalize a valid move with history
const finalizeMove = useCallback(() => {
  const { type, element: originalElement } = dragState.draggedElement;
  
  const newElements = { ...elements };
  const elementArray = type === 'waypoint' ? newElements.waypoints : 
                      type === 'exit' ? newElements.exits : 
                      type === 'distribution' ? newElements.distributions :
                      type === 'obstacle' ? newElements.obstacles : [];
  
  const currentElement = elementArray.find(el => el.id === originalElement.id);
  
  if (!currentElement) return;
  
  // Update journey connections
  const updatedConnections = journeyConnections.map(connection => {
    let updatedConnection = { ...connection };
    
    if (connection.from?.element?.id === originalElement.id) {
      updatedConnection.from = {
        ...connection.from,
        element: currentElement
      };
    }
    
    if (connection.to?.element?.id === originalElement.id) {
      updatedConnection.to = {
        ...connection.to,
        element: currentElement
      };
    }
    
    if (connection.waypoints && (
      connection.fromId === originalElement.id || 
      connection.toId === originalElement.id
    )) {
      updatedConnection.waypoints = null;
    }
    
    return updatedConnection;
  });
  
  // Use history functions to finalize the move
  updateElementsWithHistory && updateElementsWithHistory(newElements);
  updateJourneyConnectionsWithHistory && updateJourneyConnectionsWithHistory(updatedConnections);
}, [dragState, elements, journeyConnections, updateElementsWithHistory, updateJourneyConnectionsWithHistory]);
const rollbackMove = useCallback(() => {
  if (!dragState.originalElement) return;
  
  console.log('Rolling back move to original position');
  
  const { type } = dragState.draggedElement;
  const newElements = { ...elements };
  const elementArray = type === 'waypoint' ? newElements.waypoints : 
                      type === 'exit' ? newElements.exits : 
                      type === 'distribution' ? newElements.distributions :
                      type === 'obstacle' ? newElements.obstacles : [];
  
  const index = elementArray.findIndex(el => el.id === dragState.originalElement.id);
  if (index >= 0) {
    elementArray[index] = dragState.originalElement;
  }
  
  // Restore journey connections
  const restoredConnections = journeyConnections.map(connection => {
    let restoredConnection = { ...connection };
    
    if (connection.from?.element?.id === dragState.originalElement.id) {
      restoredConnection.from = {
        ...connection.from,
        element: dragState.originalElement
      };
    }
    
    if (connection.to?.element?.id === dragState.originalElement.id) {
      restoredConnection.to = {
        ...connection.to,
        element: dragState.originalElement
      };
    }
    
    return restoredConnection;
  });
  
  // Use direct updates for immediate rollback (no history since it's a cancellation)
  onElementsChange && onElementsChange(newElements);
  onJourneyConnectionsChange && onJourneyConnectionsChange(restoredConnections);
}, [dragState, elements, journeyConnections, onElementsChange, onJourneyConnectionsChange]);


const handleRotateMouseUp = useCallback(() => {
  if (!dragState.isDragging) return;
  
  // Get the current position after rotation
  const { type, element: originalElement } = dragState.draggedElement;
  
  // Find the current element (after all the preview updates)
  const currentElements = { ...elements };
  const elementArray = type === 'waypoint' ? currentElements.waypoints : 
                      type === 'exit' ? currentElements.exits : 
                      type === 'distribution' ? currentElements.distributions :
                      type === 'obstacle' ? currentElements.obstacles : [];
  
  const currentElement = elementArray.find(el => el.id === originalElement.id);
  
  if (!currentElement) {
    console.error('Could not find current element for validation');
    return;
  }
  
  // Create element info for validation using the current position
  const elementInfoForValidation = {
    ...dragState.draggedElement,
    element: currentElement
  };
  
  // Perform comprehensive validation
  const validation = validateRotation(elementInfoForValidation);
  
  if (!validation.valid) {
    // Rollback to original position
    rollbackMove(); // Reuse the same rollback function
    showErrorToast && showErrorToast(validation.message);
  } else {
    // Rotation was valid - finalize with history
    finalizeMove(); // Reuse the same finalize function
  }
  
  setDragState({
    isDragging: false,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    startPosition: null,
    originalElement: null,
    rotationCenter: null,
    initialAngle: 0
  });
}, [dragState, elements, validateRotation, rollbackMove, showErrorToast, finalizeMove]);


const handleMoveMouseUp = useCallback(() => {
  if (!dragState.isDragging) return;
  
  // Get the current position after dragging
  const { type, element: originalElement } = dragState.draggedElement;
  
  // Find the current element (after all the preview updates)
  const currentElements = { ...elements };
  const elementArray = type === 'waypoint' ? currentElements.waypoints : 
                      type === 'exit' ? currentElements.exits : 
                      type === 'distribution' ? currentElements.distributions :
                      type === 'obstacle' ? currentElements.obstacles : [];
  
  const currentElement = elementArray.find(el => el.id === originalElement.id);
  
  if (!currentElement) {
    console.error('Could not find current element for validation');
    return;
  }
  
  // Create element info for validation using the current position
  const elementInfoForValidation = {
    ...dragState.draggedElement,
    element: currentElement
  };
  
  // Perform comprehensive validation
  const validation = validateMove(elementInfoForValidation);
  
  if (!validation.valid) {
    // Show alert with specific validation error
    // alert(`Move not allowed: ${validation.message}`);
    
    // Rollback to original position
    rollbackMove();
    showErrorToast && showErrorToast(validation.message);
  } else {
    // Move was valid - finalize with history
    console.log('Move completed successfully - finalizing with history');
    finalizeMove();
  }
  
  setDragState({
    isDragging: false,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    startPosition: null,
    originalElement: null
  });
}, [dragState, elements, validateMove, rollbackMove, showErrorToast]);






  return {
    handleSimulationPlay,
    handleSimulationReset,
    handleSimulationMouseDown,
    handleSimulationMouseUp,
    handleFrameChange,
    handleDoubleClick,
    handleRightClick,
    handleKeyDown,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleElementHighlight,

    handleMoveMouseDown,
    handleMoveMouseMove,
    handleMoveMouseUp,

    handleRotateMouseDown,
    handleRotateMouseMove,
    handleRotateMouseUp
  };
};