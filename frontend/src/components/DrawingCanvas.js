import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  calculateGeometryBounds
} from '../utils/canvasUtils.js';

import {
  drawGrid,
  drawAxes,
  drawScaleBar,
  drawCoordinates,
  drawCrosshairs,
  drawZoomLevel,
  drawVertices,
  drawElements,
  drawActiveDrawing,
  drawBoundaryRulers,
  drawStaticElementsInSimulation,
  drawSimulationElements,
  drawGridSnapIndicators,
  drawAngleSnapGuide,
  drawDensityHeatmap
} from './canvasRendering.js';
import { useCanvasHandlers } from '../hooks/useCanvasHandlers.js';
import { computeJourneyPaths } from '../hooks/useRouting.js';
import { getCursorStyle,isPointInExistingObstacle } from '../utils/canvasLogic.js';
import { useCanvasLogic } from '../hooks/useCanvasLogic.js';

import '../styles/simulation-player.css';


const SNAP_ANGLE_THRESHOLD = 5; 
const SNAP_DISTANCE_THRESHOLD = 10; 

const DrawingCanvas = ({ 
  drawingMode, 
  onBoundaryComplete,   
  onElementsChange,
  onJourneyConnectionsChange,
  onDistributionClick,
  elements = { boundaries: [], exits: [], distributions: [], waypoints: [], obstacles: [], openBoundaries: [] },
  journeyConnections = [],
  // triggerAutoFit = false,
  // setTriggerAutoFit = () => {},
  trajectoryData = [],
  simulationResults = null,
  isSimulationMode = false,
  onSimulationClose,
  agentRadiusData = {},
  agentColorData = {},
  isFileUpload = false,
  setIsFileUpload = () => {},

  onLoadMoreFrames,
  trajectoryInfo,

  onUndo,
  onRedo,

  elementVisibility = {},
  highlightedElement = null,
  onHighlightedElementChange,
  individualElementVisibility,

  agentCounts = { waypoints: {}, exits: {} },
  hoveredWaypoint,
  setHoveredWaypoint,
  hoveredExit, 
  setHoveredExit,
  setWaypointTooltipPosition,
  setExitTooltipPosition,

  waypointRouting = {},
  onWaypointRoutingChange,

  saveToHistory,
  updateElementsWithHistory,
  updateJourneyConnectionsWithHistory,
  validateElements,
  dragState,
  setDragState,

  useShortestPaths,
  computeShortestPaths,

  onWaypointClick,
  onSelectedJourneyChange,

  distributionSets,
  getDistributionSet,
  getDistributionsInSet,
  setDistributionSets,

  editingWaypoint,
  setEditingWaypoint,
  isDraggingRadius,
  setIsDraggingRadius,

  colorByExit = false,
  setColorByExit,
  colorByDistribution = false,
  setColorByDistribution,
  agentDistributionColors = new Map(),
  agentExitColors = new Map(),

  showAgentTrails = false,
  setShowAgentTrails = () => {},

  showDensityHeatmap,
  setShowDensityHeatmap,
  heatmapData,
  computeHeatmap
}) => {
  const canvasRef = useRef(null);
  const prevIsSimulationModeRef = useRef(isSimulationMode);

  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight - 48 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [speedCoefficient, setSpeedCoefficient] = useState(1); // x1 normal speed
  const targetFPS = 60; // Smooth 60fps animation
  const frameInterval = 1000 / targetFPS; // 16.67ms between renders

  const [agentTrails, setAgentTrails] = useState(new Map()); 

  const [hoveredDistribution, setHoveredDistribution] = useState(null);
  const [distributionTooltipPosition, setDistributionTooltipPosition] = useState({ x: 0, y: 0 });
  const renderRef = useRef();
  const lastSimulationFrameTime = useRef(0);
  const [lastElementsCount, setLastElementsCount] = useState(0);

  

  const [prevDrawingMode, setPrevDrawingMode] = useState(null);


  const [errorToast, setErrorToast] = useState(null);
  const { screenToWorld, worldToScreen } = createCoordinateConverters(viewOffset, zoom);

  const [originalVertexState, setOriginalVertexState] = useState(null);

  const [currentSnappedPoint, setCurrentSnappedPoint] = useState(null);
  
  const showErrorToast = useCallback((message) => {
  setErrorToast(message);
  setTimeout(() => {
    setErrorToast(null);
  }, 2000); // 2 seconds
}, []);

  const {
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
    deleteElementOrVertex
  } = useCanvasLogic({
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

    useShortestPaths,
    computeShortestPaths,

    getDistributionSet,
  getDistributionsInSet,
  distributionSets,
  setDistributionSets
    
  });

  const getCursor = useCallback(() => {
  if (isSimulationMode) return 'default';
  if (isPanning) return 'grabbing';
  if (isDraggingVertex) return 'grabbing';
  
  // Simplified custom cursors
  if (drawingMode === 'delete') return 'crosshair';
  if (drawingMode === 'walkablearea' || drawingMode === 'obstacle') return 'crosshair';
  if (drawingMode === 'select' || drawingMode === 'journey') return 'pointer';
  if (drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'waypoint') return 'copy';
  
  if (hoveredVertex) return 'pointer';
  if (hoveredSnapVertex) return 'crosshair';
  
  return 'default';
}, [isSimulationMode, isPanning, isDraggingVertex, drawingMode, hoveredVertex, hoveredSnapVertex]);

  const saveIncompleteAsOpenBoundary = useCallback(() => {
    if (activeBoundary.length < 2) return null;
    
    const newElements = { ...elements };
    if (!newElements.openBoundaries) {
      newElements.openBoundaries = [];
    }
    
    const elementType = drawingMode === 'obstacle' ? 'obstacle' : 'boundary';
    const savedBoundaries = [];
    
    if (connections.length > 0) {
      const adjacency = {};
      connections.forEach(conn => {
        if (!adjacency[conn.from]) adjacency[conn.from] = [];
        if (!adjacency[conn.to]) adjacency[conn.to] = [];
        adjacency[conn.from].push(conn.to);
        adjacency[conn.to].push(conn.from);
      });
      
      const visited = new Set();
      const connectedComponents = [];
      
      Object.keys(adjacency).forEach(startVertex => {
        const startIdx = parseInt(startVertex);
        if (visited.has(startIdx)) return;
        
        const component = [];
        const queue = [startIdx];
        const componentVisited = new Set();
        
        while (queue.length > 0) {
          const current = queue.shift();
          if (componentVisited.has(current)) continue;
          
          componentVisited.add(current);
          visited.add(current);
          component.push(current);
          
          if (adjacency[current]) {
            adjacency[current].forEach(neighbor => {
              if (!componentVisited.has(neighbor)) {
                queue.push(neighbor);
              }
            });
          }
        }
        
        if (component.length >= 2) {
          connectedComponents.push(component);
        }
      });
      
      connectedComponents.forEach((component, index) => {
        if (component.length < 2) return;
        
        const componentAdjacency = {};
        component.forEach(vertex => {
          componentAdjacency[vertex] = adjacency[vertex].filter(neighbor => 
            component.includes(neighbor)
          );
        });
        
        const path = findLongestPath(componentAdjacency, component[0], component.length);
        const orderedPoints = path.map(vertexIndex => activeBoundary[vertexIndex]);
        
        if (orderedPoints.length >= 2) {
          const openBoundary = {
            id: `open_${elementType}_${Date.now()}_${index}`,
            points: orderedPoints,
            closed: false,
            type: elementType
          };
          newElements.openBoundaries.push(openBoundary);
          savedBoundaries.push(openBoundary);
        }
      });
      
      const connectedVertices = new Set(Object.keys(adjacency).map(k => parseInt(k)));
      const isolatedPoints = [];
      
      for (let i = 0; i < activeBoundary.length; i++) {
        if (!connectedVertices.has(i)) {
          isolatedPoints.push(i);
        }
      }
      
      if (isolatedPoints.length >= 2) {
        let currentSegment = [isolatedPoints[0]];
        
        for (let i = 1; i < isolatedPoints.length; i++) {
          const current = isolatedPoints[i];
          const previous = isolatedPoints[i - 1];
          
          if (current === previous + 1) {
            currentSegment.push(current);
          } else {
            if (currentSegment.length >= 2) {
              const orderedPoints = currentSegment.map(idx => activeBoundary[idx]);
              const openBoundary = {
                id: `open_${elementType}_${Date.now()}_isolated_${savedBoundaries.length}`,
                points: orderedPoints,
                closed: false,
                type: elementType
              };
              newElements.openBoundaries.push(openBoundary);
              savedBoundaries.push(openBoundary);
            }
            currentSegment = [current];
          }
        }
        
        if (currentSegment.length >= 2) {
          const orderedPoints = currentSegment.map(idx => activeBoundary[idx]);
          const openBoundary = {
            id: `open_${elementType}_${Date.now()}_isolated_${savedBoundaries.length}`,
            points: orderedPoints,
            closed: false,
            type: elementType
          };
          newElements.openBoundaries.push(openBoundary);
          savedBoundaries.push(openBoundary);
        }
      }
    } else {
      const openBoundary = {
        id: `open_${elementType}_${Date.now()}`,
        points: activeBoundary.slice(),
        closed: false,
        type: elementType
      };
      newElements.openBoundaries.push(openBoundary);
      savedBoundaries.push(openBoundary);
    }
    
    return { newElements, savedBoundaries };
  }, [activeBoundary, connections, elements, drawingMode]);


  const saveIncompleteBoundary = useCallback(() => {
    if (activeBoundary.length >= 2) {
      const result = saveIncompleteAsOpenBoundary();
      if (result && result.savedBoundaries.length > 0) {
        onElementsChange && onElementsChange(result.newElements);
       
      }
    }
    cancelBoundaryDrawing();
  }, [activeBoundary.length, saveIncompleteAsOpenBoundary, onElementsChange, cancelBoundaryDrawing]);
  
  const canColorByExit = useMemo(() => {
  if (!simulationResults || !trajectoryData || trajectoryData.length === 0) {
    return false;
  }
  
  // Check if simulation completed naturally (not cut off by max time)
  const simulationCompletedNaturally = simulationResults.evacuation_time < simulationResults.max_simulation_time;
  
  // Check if all agents have evacuated
  const allAgentsEvacuated = simulationResults.agents_evacuated === simulationResults.total_agents;
  
  // Only enable if both conditions are met
  return simulationCompletedNaturally && allAgentsEvacuated;
}, [simulationResults, trajectoryData]);

   const { handleSimulationPlay,
    handleSimulationReset,
    handleSimulationMouseDown,
    handleSimulationMouseUp,
    handleFrameChange,
    handleDoubleClick,
    handleRightClick,
    handleWheel,
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
  } = useCanvasHandlers({
      //values added for mouse handlers
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

  useShortestPaths,
  computeShortestPaths,
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
});

  
  const TRAIL_LENGTH = 20; 
  
  
  const THEME_COLORS = {
    background: 'rgba(37, 99, 235, 0.08)',
    boundary: '#2563eb',
    boundaryFill: 'rgba(37, 99, 235, 0.08)',
    exit: '#dc2626',
    exitFill: 'rgba(220, 38, 38, 0.12)',
    distribution: '#059669',
    distributionFill: 'rgba(5, 150, 105, 0.08)',
    obstacle: '#64748b',
    obstacleFill: 'rgba(100, 116, 139, 0.15)',
    waypoint: '#7c3aed',
    waypointFill: 'rgba(124, 58, 237, 0.08)',
    grid: 'rgba(148, 163, 184, 0.3)',
    accent: '#0ea5e9'
  };

  const calculateOriginalBounds = useCallback(() => {
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

  const autoFitViewForSimulation = useCallback(() => {
    if (elements.boundaries.length === 0) return;
    
    const bounds = calculateOriginalBounds();
    const simBounds = {
      minX: (bounds.minX - (bounds.minX + bounds.maxX) / 2) * SCALE_FACTOR,
      maxX: (bounds.maxX - (bounds.minX + bounds.maxX) / 2) * SCALE_FACTOR,
      minY: (bounds.minY - (bounds.minY + bounds.maxY) / 2) * SCALE_FACTOR,
      maxY: (bounds.maxY - (bounds.minY + bounds.maxY) / 2) * SCALE_FACTOR
    };
    
    const contentWidth = (simBounds.maxX - simBounds.minX) * DISPLAY_SCALE;
    const contentHeight = (simBounds.maxY - simBounds.minY) * DISPLAY_SCALE;
    
    const zoomX = (canvasSize.width * 0.8) / contentWidth;
    const zoomY = (canvasSize.height * 0.8) / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 3);
    
    const centerX = (simBounds.minX + simBounds.maxX) / 2;
    const centerY = (simBounds.minY + simBounds.maxY) / 2;
    
    setZoom(newZoom);
    setViewOffset({
      x: canvasSize.width / 2 - centerX * DISPLAY_SCALE * newZoom,
      y: canvasSize.height / 2 - centerY * DISPLAY_SCALE * newZoom
    });
  }, [calculateOriginalBounds, canvasSize, elements.boundaries.length]);
  
  

 useEffect(() => {
  if (isSimulationMode && trajectoryData.length > 0) {
    // Run autofit whenever entering simulation mode with data
    autoFitViewForSimulation();
    setCurrentFrame(0);
    setIsPlaying(false);
    setAgentTrails(new Map());
  }
}, [isSimulationMode]);


  function distanceToLine(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
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
const handleCanvasClick = useCallback((event) => {
  if (drawingMode === 'select') {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const worldPos = screenToWorld(x, y);
    
    const clickedElement = findElementAtPoint(worldPos, elements);
    if (clickedElement) {
      onHighlightedElementChange(highlightedElement?.id === clickedElement.element.id ? null : clickedElement.element);
    } else {
      // Check for journey connections
      const clickedConnection = journeyConnections.find(conn => {
        const fromElement = [...elements.waypoints, ...elements.exits, ...elements.distributions]
          .find(el => el.id === conn.fromId);
        const toElement = [...elements.waypoints, ...elements.exits, ...elements.distributions]
          .find(el => el.id === conn.toId);
        
        if (fromElement && toElement) {
          const fromCenter = getElementCenter(fromElement);
          const toCenter = getElementCenter(toElement);
          
          if (fromCenter && toCenter) {
            const distance = distanceToLine(worldPos, fromCenter, toCenter);
            return distance < (10 / zoom);
          }
        }
        return false;
      });
      
      if (clickedConnection) {
        const connectionId = `${clickedConnection.journeyId}_${clickedConnection.fromId}_${clickedConnection.toId}`;
        const connectionObj = {
          ...clickedConnection,
          connectionId: connectionId,
          type: 'journeyConnection'
        };
        onHighlightedElementChange(highlightedElement?.connectionId === connectionId ? null : connectionObj);
      } else {
        onHighlightedElementChange(null);
      }
    }
  }
}, [drawingMode, screenToWorld, elements, journeyConnections, zoom, highlightedElement, onHighlightedElementChange]);

const autoFitToGeometry = useCallback(() => {
  
  const bounds = calculateGeometryBounds(elements);
  
  if (!bounds) {
   
    return;
  }
    
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  
  const paddingX = canvasSize.width * 0.1;
  const paddingY = canvasSize.height * 0.1;
  
  const zoomX = (canvasSize.width - 2 * paddingX) / contentWidth;
  const zoomY = (canvasSize.height - 2 * paddingY) / contentHeight;
  const newZoom = Math.min(zoomX, zoomY, 3);
  
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  const newViewOffset = {
    x: canvasSize.width / 2 - centerX * newZoom,
    y: canvasSize.height / 2 - centerY * newZoom
  };
    
  setZoom(newZoom);
  setViewOffset(newViewOffset);
}, [calculateGeometryBounds, canvasSize, elements]);

// autofit 
useEffect(() => {
  const currentElementsCount = 
    elements.boundaries.length + 
    elements.exits.length + 
    elements.distributions.length + 
    elements.waypoints.length + 
    elements.obstacles.length;
  
  
  if (currentElementsCount > 0 && 
      currentElementsCount > lastElementsCount && 
      !isSimulationMode &&
      isFileUpload) { 
        
    setTimeout(() => {
      autoFitToGeometry();
      // Reset the upload flag after autofit
      setIsFileUpload(false);
    }, 50);
  } else if (!isFileUpload) {
    
  }
  
  setLastElementsCount(currentElementsCount);
}, [elements.boundaries.length, elements.exits.length, elements.distributions.length, 
    elements.waypoints.length, elements.obstacles.length, lastElementsCount, 
    isSimulationMode, isFileUpload, autoFitToGeometry, setIsFileUpload]);


//   useEffect(() => {
//   console.log('AutoFit Effect Triggered:', {
//     triggerAutoFit,
//     boundariesLength: elements.boundaries.length,
//     setTriggerAutoFitExists: !!setTriggerAutoFit
//   });
  
//   // Only run when triggerAutoFit is true, not when it becomes false
//   if (triggerAutoFit && elements.boundaries.length > 0) {
//     console.log('AutoFit conditions met, executing...');
//     const timeoutId = setTimeout(() => {
//       console.log('Calling autoFitToGeometry...');
//       autoFitToGeometry();
//       console.log('Resetting triggerAutoFit...');
//       setTriggerAutoFit(false);
//     }, 100);
    
//     return () => {
//       console.log('Cleaning up autofit timeout');
//       clearTimeout(timeoutId);
//     };
//   }
  
//   // Remove elements.boundaries.length from dependencies to prevent interference
// }, [triggerAutoFit, autoFitToGeometry, setTriggerAutoFit]); // Removed elements.boundaries.length


useEffect(() => {
  // This effect triggers an autofit whenever switching from simulation back to draw mode.
  if (prevIsSimulationModeRef.current && !isSimulationMode) {
    // Use a short timeout to ensure the canvas has updated its render logic
    // before calculating the geometry bounds.
    setTimeout(() => {
      autoFitToGeometry();
    }, 100);
  }
  // Update the ref to the current value for the next render.
  prevIsSimulationModeRef.current = isSimulationMode;
}, [isSimulationMode, autoFitToGeometry]);
  useEffect(() => { 
    const handleResize = () => {
      setCanvasSize({ 
        width: window.innerWidth, 
        height: window.innerHeight - 48
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  
  useEffect(() => {
    setViewOffset({ 
      x: canvasSize.width / 2, 
      y: (canvasSize.height) / 2
    });
  }, [canvasSize]); 

const updateAgentTrails = useCallback((frameData) => {
    setAgentTrails(prevTrails => {
      const newTrails = new Map(prevTrails);
      
      frameData.agents.forEach(agent => {
        const agentId = agent.agent_id;
        const currentTrail = newTrails.get(agentId) || [];
        
        
        const newTrail = [...currentTrail, { x: agent.x, y: agent.y, frame: currentFrame }];
        
        
        const trimmedTrail = newTrail.slice(-TRAIL_LENGTH);
        
        newTrails.set(agentId, trimmedTrail);
      });
      
      return newTrails;
    });
  }, [currentFrame]);
  


  const exportElements = useCallback(() => {
    return { elements: getElementsForExport(elements), journeyConnections: journeyConnections };
  }, [elements, journeyConnections]);
  
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.exportElements = exportElements;
    }
  }, [exportElements]);

  
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  useEffect(() => {
  if (!isSimulationMode) {
    // Check if we switched between walkablearea and obstacle
    if (prevDrawingMode && 
        prevDrawingMode !== drawingMode && 
        (prevDrawingMode === 'walkablearea' || prevDrawingMode === 'obstacle') && 
        (drawingMode === 'walkablearea' || drawingMode === 'obstacle')) {
      // Reset state when switching between these two modes
      cancelBoundaryDrawing();
    } 
    // Original logic for changing to non-drawing modes
    else if (drawingMode !== 'walkablearea' && drawingMode !== 'obstacle') {
      if (activeBoundary.length >= 2) {
        saveIncompleteBoundary();
      } else {
        cancelBoundaryDrawing();
      }
    }
    
    // Update previous drawing mode
    setPrevDrawingMode(drawingMode);
  }
}, [isSimulationMode, drawingMode, prevDrawingMode]);

useEffect(() => {
  if (!canColorByExit && colorByExit) {
    setColorByExit(false);
  }
}, [canColorByExit, colorByExit, setColorByExit]);


  

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    
    ctx.fillStyle = THEME_COLORS.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    if (isSimulationMode) {
      
      drawStaticElementsInSimulation(ctx,elements,zoom,isSimulationMode,simulationToScreen,calculateOriginalBounds,transformToSimulationCoords,THEME_COLORS,DISPLAY_SCALE,viewOffset);

      if (showDensityHeatmap && heatmapData) {
    drawDensityHeatmap(ctx, heatmapData, simulationToScreen, viewOffset, zoom, DISPLAY_SCALE);
  }
  
      drawSimulationElements(ctx,trajectoryData,currentFrame,agentTrails,agentRadiusData,agentColorData,zoom,isSimulationMode,simulationToScreen,DISPLAY_SCALE,updateAgentTrails,viewOffset,journeyConnections,colorByExit,colorByDistribution,agentDistributionColors,agentExitColors,showAgentTrails);
    } else {
      
      drawGrid(ctx, viewOffset, zoom, canvasSize);

      
      // ONLY show snapping when drawing boundaries or obstacles
if (!isSimulationMode && zoom >= 0.5 && 
    (drawingMode === 'walkablearea' || drawingMode === 'obstacle')) {
  drawGridSnapIndicators(ctx, mousePosition, screenToWorld, worldToScreen, zoom);
  
  // Draw angle snap guide for active drawing
  if (showPreviewLine && previewPoint && lastConnectedPoint !== null) {
    const fromPoint = activeBoundary[lastConnectedPoint];
    drawAngleSnapGuide(ctx, fromPoint, previewPoint, worldToScreen, zoom);
  }
}

      drawAxes(ctx, worldToScreen, canvasSize);
      drawElements(ctx, elements, worldToScreen, zoom, selectedElements, journeyConnections, elementVisibility, highlightedElement, individualElementVisibility, editingWaypoint);



      drawActiveDrawing(ctx, drawingMode, activeBoundary, worldToScreen, connections, showPreviewLine, previewPoint, lastConnectedPoint, hoveredSnapVertex, isDragging, dragStart, dragCurrent, SNAP_RADIUS);

      // drawVertices(ctx, elements, worldToScreen, hoveredVertex, activeBoundary);
      drawCrosshairs(ctx, mousePosition, canvasSize);
      drawCoordinates(ctx, mousePosition, screenToWorld);
    }
    
    
    drawScaleBar(ctx, zoom, worldToScreen, screenToWorld, canvasSize);
  if (!isSimulationMode && (drawingMode === 'walkablearea' || elements.boundaries.length > 0)) {
    drawBoundaryRulers(ctx, elements.boundaries, activeBoundary, worldToScreen, screenToWorld, canvasSize, zoom);
  }
    drawZoomLevel(ctx, zoom, canvasSize);
  }, [
    canvasSize, viewOffset, zoom, worldToScreen, screenToWorld, elements, selectedElements, 
    journeyConnections, drawingMode, activeBoundary, connections, showPreviewLine, 
    previewPoint, lastConnectedPoint, hoveredSnapVertex, isDragging, dragStart, 
    dragCurrent, hoveredVertex, mousePosition, isSimulationMode, drawStaticElementsInSimulation, drawSimulationElements, THEME_COLORS.background]);
  
  
  const scheduleRender = useCallback(() => {
  if (renderRef.current) {
    cancelAnimationFrame(renderRef.current);
  }
  
  renderRef.current = requestAnimationFrame((currentTime) => {
    if (isSimulationMode && isPlaying && trajectoryData.length > 0) {
      if (currentTime - lastSimulationFrameTime.current >= frameInterval) {
        
        // Advance by speedCoefficient frames each update for smooth fast playback
        const nextFrame = currentFrame + speedCoefficient;
        
        if (nextFrame < trajectoryData.length - 1) {
          setCurrentFrame(nextFrame);
          lastSimulationFrameTime.current = currentTime;
        } else if (nextFrame >= trajectoryData.length - 1) {
          // Reached the end
          setCurrentFrame(trajectoryData.length - 1);
          if (!trajectoryInfo?.hasMore) {
            setIsPlaying(false);
          }
        }
      }
    }
    
    render();
    renderRef.current = null;
    
    if (isSimulationMode && (isPlaying || trajectoryInfo?.isLoading)) {
      scheduleRender();
    }
  });
}, [isSimulationMode, isPlaying, trajectoryData.length, currentFrame, render, 
    trajectoryInfo?.hasMore, trajectoryInfo?.isLoading, speedCoefficient, frameInterval]);
  
useEffect(() => {
  scheduleRender();
}, [scheduleRender]);


  return (
    <div className="canvas-container-fullscreen">
      {}
      
{isSimulationMode && (
  <div className="simulation-controls">
    <div className="simulation-controls-inner">
      <button 
        onClick={handleSimulationPlay}
        className="simulation-btn simulation-btn-primary"
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      
      <button 
        onClick={handleSimulationReset}
        className="simulation-btn simulation-btn-secondary"
      >
        ⏹️ Reset
      </button>
      
      <div className="frame-control">
  <input
  type="range"
  min="0"
  max={Math.max(0, trajectoryData.length - 1)}
  value={Math.min(currentFrame, Math.max(0, trajectoryData.length - 1))}
  onChange={(e) => {
    const newFrame = parseInt(e.target.value);
    setCurrentFrame(Math.min(newFrame, trajectoryData.length - 1));
  }}
  className="frame-slider"
/>
  <div className="frame-info">
    {Math.min(currentFrame + 1, trajectoryData.length)}/{trajectoryData.length}
    {/* {trajectoryInfo?.totalFrames > trajectoryData.length && (
      <span style={{ color: '#orange', marginLeft: '8px', fontSize: '0.8rem' }}>
        ({trajectoryData.length}/{trajectoryInfo.totalFrames} loaded)
      </span>
    )} */}
  </div>
</div>
      
      <div className="speed-control">
  <label>Speed:</label>
  <div className="speed-control-container">
    <button 
      onClick={() => setSpeedCoefficient(Math.max(1, speedCoefficient - 1))}
      className="speed-btn speed-btn-minus"
      disabled={speedCoefficient <= 1}
    >
      −
    </button>
    
    <input
      type="number"
      min="1"
      max="10"
      step="1"
      value={speedCoefficient}
      onChange={(e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 1 && value <= 10) {
          setSpeedCoefficient(value);
        }
      }}
      className="speed-input"
    />
    
    <button 
      onClick={() => setSpeedCoefficient(Math.min(10, speedCoefficient + 1))}
      className="speed-btn speed-btn-plus"
      disabled={speedCoefficient >= 10}
    >
      +
    </button>
    
    <span className="speed-multiplier">x{speedCoefficient.toFixed(1)}</span>
  </div>
  
  
</div>
      
      <button 
        onClick={onSimulationClose}
        className="simulation-btn simulation-btn-secondary"
      >
        ✕ Close
      </button>
    </div>
  </div>
)}

      {}
      {isSimulationMode && simulationResults && trajectoryData[currentFrame] && (
        <div className="simulation-info">
          <div className="simulation-info-title">Simulation Status</div>
          <div className="simulation-info-grid">
            <div className="simulation-info-item">
              <span className="simulation-info-label">Time</span>
              <span className="simulation-info-value">
                {((currentFrame / trajectoryData.length) * simulationResults.evacuation_time).toFixed(1)}s
              </span>
            </div>
            <div className="simulation-info-item">
              <span className="simulation-info-label">Max Time</span>
              <span className="simulation-info-value">
                {simulationResults.max_simulation_time}s
              </span>
            </div>
            <div className="simulation-info-item">
              <span className="simulation-info-label">Active</span>
              <span className="simulation-info-value">
                {trajectoryData[currentFrame].agents.length}
              </span>
            </div>
            <div className="simulation-info-item">
              <span className="simulation-info-label">Total</span>
              <span className="simulation-info-value">
                {simulationResults.total_agents}
              </span>
            </div>
            <div className="simulation-info-item">
              <span className="simulation-info-label">Evacuated</span>
              <span className="simulation-info-value">
                {simulationResults.agents_evacuated}
              </span>
            </div>
            <div className="simulation-info-item">
              <span className="simulation-info-label">Exit Time</span>
              <span className="simulation-info-value">
                {simulationResults.evacuation_time}s
              </span>
            </div>
          </div>
          
          {}
          <div className="simulation-progress">
            <div className="simulation-progress-label">
              Progress: {((currentFrame / (trajectoryData.length - 1)) * 100).toFixed(0)}%
            </div>
            <div className="simulation-progress-bar">
              <div 
                className="simulation-progress-fill"
                style={{
                  width: `${(currentFrame / (trajectoryData.length - 1)) * 100}%`
                }}
              ></div>
            </div>
          </div>

          
        </div>
      )}

      {isSimulationMode && (
  <div className="simulation-coloring-options" style={{ 
    position: 'absolute',
    top: '120px', 
    right: '20px',
    backgroundColor: 'rgba(17, 17, 19, 0.95)',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    zIndex: 1000
  }}>
    
    
  </div>
)}
      

{}

{hoveredDistribution && !isSimulationMode && (
  <div 
    className="distribution-tooltip"
    style={{
      position: 'absolute',
      left: distributionTooltipPosition.x + 15,
      top: distributionTooltipPosition.y - 10,
      zIndex: 1000,
      pointerEvents: 'none' 
    }}
  >
    <div className="distribution-tooltip-content">
      <div className="distribution-tooltip-title">
        {/* Distribution: {hoveredDistribution.id} */}
        Distribution
      </div>
      <div className="distribution-tooltip-params">
        <div className="param-row">
          <span className="param-label">Agents:</span>
          <span className="param-value">{hoveredDistribution.parameters?.number || 10}</span>
        </div>
        <div className="param-row">
          <span className="param-label">Radius:</span>
          <span className="param-value">{hoveredDistribution.parameters?.radius || 0.2}m</span>
        </div>
        <div className="param-row">
          <span className="param-label">Speed:</span>
          <span className="param-value">{hoveredDistribution.parameters?.v0 || 1.3}m/s</span>
        </div>
      </div>
    </div>
  </div>
)}
     
      <canvas
        ref={canvasRef}
        
        width={canvasSize.width}
        height={canvasSize.height}
onMouseDown={
    isSimulationMode 
      ? handleSimulationMouseDown 
      : drawingMode === 'move' 
        ? handleMoveMouseDown 
        : drawingMode === 'rotate'
          ? handleRotateMouseDown
          : handleMouseDown
  }        
  onMouseMove={
    drawingMode === 'move' 
      ? handleMoveMouseMove 
      : drawingMode === 'rotate'
        ? handleRotateMouseMove
        : handleMouseMove
  }
  onMouseUp={
    isSimulationMode 
      ? handleSimulationMouseUp 
      : drawingMode === 'move' 
        ? handleMoveMouseUp 
        : drawingMode === 'rotate'
          ? handleRotateMouseUp
          : handleMouseUp
  }
        onDoubleClick={!isSimulationMode ? handleDoubleClick : undefined}
        onContextMenu={handleRightClick}  
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        style={{ 
          cursor: getCursor(),
          touchAction: 'none',
          display: 'block',
          position: 'absolute',
          top: '60px',
          left: 0
        }}
        tabIndex={0}
      />

      {errorToast && (
  <div className="error-toast">
    {errorToast}
  </div>
)}
    </div>
  );
};

export default DrawingCanvas;