import React, { useRef, useState, useCallback, useEffect } from 'react';
import DrawingCanvas from './components/DrawingCanvas';
import './styles/professional.css';
import { useSimulationProgress } from './hooks/useSimulationProgress';
import { SimulationProgressModal } from './components/Progress/SimulationProgressModal';
import { GRID_SIZE, isPointInPolygon } from './utils/canvasUtils';
import { useParsing } from './hooks/useParsing';
import { useFileHandler } from './hooks/useFileHandler';

import ScenarioGallery from './components/Scenario/ScenarioGallery';
import ScenarioSaveModal from './components/Scenario/ScenarioSaveModal';
import Chatbot from './components/Chatbot/Chatbot';

import { useTrajectoryData } from './hooks/useTrajectoryData';
import { TrajectoryProgress } from './components/TrajectoryProgress';
import JourneyEditor from './components/JourneyEditor';
import JourneyAssignmentTool from './components/JourneyAssignmentTool';

export default function OfflineApp() {
  
  const SCALE_FACTOR = 0.1;
  
  const [drawingMode, setDrawingMode] = useState('select');
  const [elements, setElements] = useState({
    boundaries: [],
    exits: [],
    distributions: [],
    waypoints: [],
    obstacles: [],
    journeys: []
  });

  const projectFileInputRef = useRef(null);
  
  const [journeyConnections, setJourneyConnections] = useState([]);
  
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  
  const [selectedDistribution, setSelectedDistribution] = useState(null);
  const [showDistributionEditor, setShowDistributionEditor] = useState(false);

  const [triggerAutoFit, setTriggerAutoFit] = useState(false);
  
  const [simulationParams, setSimulationParams] = useState({
  max_simulation_time: 300.0,
  model_type: 'CollisionFreeSpeedModel',
   
  strength_neighbor_repulsion: 2.6,
  range_neighbor_repulsion: 0.1,
  
  mass: 80.0,
  tau: 0.5,
  
  relaxation_time: 0.5,
  agent_strength: 2000,
  agent_range: 0.08,
  
  T: 1.0,
  s0: 0.5
});
  
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  // const [trajectoryData, setTrajectoryData] = useState([]);

  const [availableModels, setAvailableModels] = useState([]);

  const [currentViewMode, setCurrentViewMode] = useState('draw'); 
  
  const [showParametersPanel, setShowParametersPanel] = useState(false);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [showElementsOverview, setShowElementsOverview] = useState(false);
  const [showJourneyPanel, setShowJourneyPanel] = useState(false);



  const [showProgressModal, setShowProgressModal] = useState(false);
  const { progress, startSimulation, cancelSimulation, isLoading, error: progressError, results: progressResults, simulationId } = useSimulationProgress();
  const { trajectoryData: chunkedTrajectoryData, loadTrajectoryChunk, loadMoreFrames, loadAllTrajectory, resetTrajectoryData } = useTrajectoryData(simulationId);

  const trajectoryData = chunkedTrajectoryData.frames;
  const hasTrajectoryData = chunkedTrajectoryData.totalFrames > 0;
  
  const [isFileUpload, setIsFileUpload] = useState(false);
  
  
  const [showScenarioGallery, setShowScenarioGallery] = useState(false);
  const [showScenarioSave, setShowScenarioSave] = useState(false);

  const [downloadSqlite, setDownloadSqlite] = useState(false);
  const [numberOfSimulations, setNumberOfSimulations] = useState(1);
  const [baseSeed, setBaseSeed] = useState(420);
  const [availableSeeds, setAvailableSeeds] = useState([]);

  const [waypointRouting, setWaypointRouting] = useState({});
  const handleWaypointRoutingChange = useCallback((newRouting) => {
    setWaypointRouting(newRouting);
  }, []);

  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [showWaypointEditor, setShowWaypointEditor] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState('J1');
  

  const [useShortestPaths, setUseShortestPaths] = useState(false);

  const [elementVisibility, setElementVisibility] = useState({
  boundaries: true,
  exits: true,
  distributions: true,
  waypoints: true,
  obstacles: true,
  journeyConnections: true
  });
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null); 
  const [individualElementVisibility, setIndividualElementVisibility] = useState({});

  const [hoveredWaypoint, setHoveredWaypoint] = useState(null);
  const [hoveredExit, setHoveredExit] = useState(null);
  const [waypointTooltipPosition, setWaypointTooltipPosition] = useState({ x: 0, y: 0 });
  const [exitTooltipPosition, setExitTooltipPosition] = useState({ x: 0, y: 0 });

  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    startPosition: null,
    originalElement: null,
    previewElement: null
  });

  const [distributionSets, setDistributionSets] = useState({});
  const [selectedSet, setSelectedSet] = useState(null);
  const [showSetManager, setShowSetManager] = useState(false);

  const [editingWaypoint, setEditingWaypoint] = useState(null);
  const [isDraggingRadius, setIsDraggingRadius] = useState(false);

  const [colorByExit, setColorByExit] = useState(false);
  const [colorByDistribution, setColorByDistribution] = useState(false);
  const [agentDistributionColors, setAgentDistributionColors] = useState(new Map());
  const [agentExitColors, setAgentExitColors] = useState(new Map());

  const [showAgentTrails, setShowAgentTrails] = useState(false);

  const [showDensityHeatmap, setShowDensityHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState(null);

  const [showChatbot, setShowChatbot] = useState(false);

  



  // Initialize the parsing hook
  const { parseCombinedFiles } = useParsing({
    setElements,
    setJourneyConnections,
    setIsFileUpload,
    setWaypointRouting
  });

  // Initialize the file handler hook
  const {
    handleDxfUpload,
    handleDxfUploadClick,
    handleCombinedUpload,
    handleCombinedUploadClick,
    generateConfigFromDrawing,
    generateConfigForSave,
    handleSaveJsonAndWkt,
    validateElements,
    handleProjectUpload,
    handleProjectUploadClick,
    handleProjectDownload
  } = useFileHandler({
    elements,
    journeyConnections,
    setError,
    setIsFileUpload,
    SCALE_FACTOR,
    GRID_SIZE,
    setElements,
    setJourneyConnections,
    setWaypointRouting
  });

  const toggleElementsOverview = useCallback(() => {
    setShowElementsOverview(prev => !prev);
    setShowParametersPanel(false);
    setShowFilesPanel(false);
    setShowJourneyPanel(false);
  }, []);

  const toggleJourneyPanel = useCallback(() => {
    setShowJourneyPanel(prev => !prev);
    setShowParametersPanel(false);
    setShowFilesPanel(false);
    setShowElementsOverview(false);
}, []);

const handleWaypointClick = useCallback((waypointId) => {
  const waypoint = elements.waypoints.find(w => w.id === waypointId);
  if (waypoint) {
    setSelectedWaypoint(waypoint);
    setShowWaypointEditor(true);
  }
}, [elements.waypoints]);




const getDistributionSet = useCallback((distributionId) => {
  return Object.entries(distributionSets).find(([setId, set]) => 
    set.distributionIds.includes(distributionId)
  )?.[0] || null;
}, [distributionSets]);

const getDistributionsInSet = useCallback((setId) => {
  if (!distributionSets[setId]) return [];
  return distributionSets[setId].distributionIds.map(id => 
    elements.distributions.find(d => d.id === id)
  ).filter(Boolean);
}, [distributionSets, elements.distributions]);

const getDistributionColor = useCallback((distributionIndex) => {
 const colors = [
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#22c55e', // Green
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#eab308', // Yellow
  '#14b8a6', // Teal
  '#8b5cf6', // Purple
  '#d946ef', // Magenta
  '#84cc16', // Lime
  '#2563eb', // Royal Blue
  '#ec4899', // Pink
  '#16a34a', // Forest Green
  '#0ea5e9', // Sky Blue
  '#a855f7', // Violet
  '#f43f5e', // Rose
  '#a16207', // Olive
  '#3b82f6', // Blue
  '#78350f', // Brown
  '#64748b'  // Slate Gray
];


  return colors[distributionIndex % colors.length];
}, []);

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

const processAgentColors = useCallback(() => {
  if (!trajectoryData || trajectoryData.length === 0) return;
  
  const newDistributionColors = new Map();
  const newExitColors = new Map();
  
  // Calculate bounds for coordinate transformation
  const bounds = calculateOriginalBounds();
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Process distribution colors - track first appearance of each agent
  if (colorByDistribution) {
    const processedAgents = new Set();
    
    // Iterate through ALL frames to catch agents as they spawn
    trajectoryData.forEach((frame, frameIndex) => {
      frame.agents.forEach(agent => {
        // Skip if we've already processed this agent
        if (processedAgents.has(agent.agent_id)) return;
        
        // Transform agent position from simulation coordinates back to frontend coordinates
        const frontendX = (agent.x / SCALE_FACTOR) + centerX;
        const frontendY = (agent.y / SCALE_FACTOR) + centerY;
        const agentPoint = { x: frontendX, y: frontendY };
        
        // Find which distribution this agent belongs to
        for (let i = 0; i < elements.distributions.length; i++) {
          const distribution = elements.distributions[i];
          
          if (isPointInPolygon(agentPoint, distribution.points)) {
            newDistributionColors.set(agent.agent_id, getDistributionColor(i));
            processedAgents.add(agent.agent_id);
            break;
          }
        }
      });
    });
  }
  
  // Process exit colors - find last frame for each agent (unchanged)
  if (colorByExit) {
    const agentLastFrames = new Map();
    
    // Find last frame for each agent
    trajectoryData.forEach((frame, frameIndex) => {
      frame.agents.forEach(agent => {
        // Transform coordinates back to frontend space
        const frontendX = (agent.x / SCALE_FACTOR) + centerX;
        const frontendY = (agent.y / SCALE_FACTOR) + centerY;
        agentLastFrames.set(agent.agent_id, { 
          frame: frameIndex, 
          position: { x: frontendX, y: frontendY } 
        });
      });
    });
    
    // Assign colors based on closest exit in last frame
    agentLastFrames.forEach((lastFrame, agentId) => {
      let closestExit = null;
      let minDistance = Infinity;
      
      elements.exits.forEach((exit, exitIndex) => {
        const exitCenter = {
          x: exit.points.reduce((sum, p) => sum + p.x, 0) / exit.points.length,
          y: exit.points.reduce((sum, p) => sum + p.y, 0) / exit.points.length
        };
        
        const distance = Math.sqrt(
          Math.pow(lastFrame.position.x - exitCenter.x, 2) + 
          Math.pow(lastFrame.position.y - exitCenter.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestExit = exitIndex;
        }
      });
      
      if (closestExit !== null) {
        newExitColors.set(agentId, getDistributionColor(closestExit));
      }
    });
  }
  
  setAgentDistributionColors(newDistributionColors);
  setAgentExitColors(newExitColors);
}, [trajectoryData, elements.distributions, elements.exits, colorByDistribution, colorByExit, getDistributionColor, calculateOriginalBounds, SCALE_FACTOR]);

const saveToHistory = useCallback(() => {
    const currentState = {
      elements: JSON.parse(JSON.stringify(elements)),
      journeyConnections: JSON.parse(JSON.stringify(journeyConnections))
    };
    
    setUndoStack(prev => {
      const newStack = [...prev, currentState];
      return newStack.slice(-50);
    });
    
    setRedoStack([]);
  }, [elements, journeyConnections]);

  const updateElementsWithHistory = useCallback((newElements, skipHistory = false) => {
    if (!skipHistory) {
      saveToHistory();
    }
    setElements(newElements);
  }, [saveToHistory]);

  const updateJourneyConnectionsWithHistory = useCallback((newConnections, skipHistory = false) => {
    if (!skipHistory) {
      saveToHistory();
    }
    setJourneyConnections(newConnections);
  }, [saveToHistory]);

  const handleBoundaryComplete = useCallback((boundary, openBoundaryInfo) => {
    saveToHistory();
    
    const newElements = { ...elements };
    newElements.boundaries = [...newElements.boundaries, boundary];
    
    if (openBoundaryInfo && (openBoundaryInfo.continuingFromOpenBoundary || openBoundaryInfo.mergedOpenBoundaries.length > 0)) {
      const boundaryIdsToRemove = new Set([
        ...(openBoundaryInfo.continuingFromOpenBoundary ? [openBoundaryInfo.continuingFromOpenBoundary.id] : []),
        ...openBoundaryInfo.mergedOpenBoundaries
      ]);
      
      newElements.openBoundaries = newElements.openBoundaries.filter(
        ob => !boundaryIdsToRemove.has(ob.id)
      );
    }
    
    setElements(newElements);
  }, [saveToHistory, elements]);

  const handleElementsChange = useCallback((newElements) => {
    updateElementsWithHistory(newElements);
  }, [updateElementsWithHistory]);

  
  const handleDistributionClick = useCallback((distributionId) => {
    const distribution = elements.distributions.find(d => d.id === distributionId);
    if (distribution) {
      setSelectedDistribution(distribution);
      setShowDistributionEditor(true);
    }
  }, [elements.distributions]);

  const updateWaypointParameters = useCallback((waypointId, newParameters) => {
    saveToHistory();
    
    setElements(prev => {
      const newElements = { ...prev };
      const waypointIndex = newElements.waypoints.findIndex(w => w.id === waypointId);
      if (waypointIndex >= 0) {
        newElements.waypoints[waypointIndex] = {
          ...newElements.waypoints[waypointIndex],
          ...newParameters
        };
      }
      return newElements;
    });
  }, [saveToHistory]);
  
  const updateDistributionParameters = useCallback((distributionId, newParameters) => {
    saveToHistory();
    
    setElements(prev => {
      const newElements = { ...prev };
      const distributionIndex = newElements.distributions.findIndex(d => d.id === distributionId);
      if (distributionIndex >= 0) {
        newElements.distributions[distributionIndex] = {
          ...newElements.distributions[distributionIndex],
          parameters: {
            ...newElements.distributions[distributionIndex].parameters,
            ...newParameters
          }
        };
      }
      return newElements;
    });
  }, [saveToHistory]);
// Update your convertWaypointRoutingIds function to also convert journey IDs:
const convertWaypointRoutingIds = useCallback((waypointRouting, simulationConfig) => {
  const convertedRouting = {};
  
  // Create mapping from original waypoint IDs to JuPedSim IDs
  const waypointIdMapping = {};
  const originalWaypoints = elements.waypoints || [];
  const simConfigWaypoints = simulationConfig.waypoints || {};
  const simConfigWaypointIds = Object.keys(simConfigWaypoints);
  
  originalWaypoints.forEach((waypoint, index) => {
    if (index < simConfigWaypointIds.length) {
      waypointIdMapping[waypoint.id] = simConfigWaypointIds[index];
    }
  });
  
  // Create mapping from original exit IDs to JuPedSim IDs
  const exitIdMapping = {};
  const originalExits = elements.exits || [];
  const simConfigExits = simulationConfig.exits || {};
  const simConfigExitIds = Object.keys(simConfigExits);
  
  originalExits.forEach((exit, index) => {
    if (index < simConfigExitIds.length) {
      exitIdMapping[exit.id] = simConfigExitIds[index];
    }
  });
  
  // Create mapping from original journey IDs to simulation config journey IDs
  const journeyIdMapping = {};
  const simConfigJourneys = simulationConfig.journeys || [];
  const frontendJourneyIds = [...new Set(journeyConnections.map(conn => conn.journeyId))].filter(Boolean);
  
  frontendJourneyIds.forEach((frontendJourneyId, index) => {
    if (index < simConfigJourneys.length) {
      const simConfigJourneyId = simConfigJourneys[index].id;
      journeyIdMapping[frontendJourneyId] = simConfigJourneyId;
    }
  });
  
  // Combined target mapping (waypoints + exits)
  const targetIdMapping = { ...waypointIdMapping, ...exitIdMapping };

  
  // Convert waypoint routing using all mappings
  Object.entries(waypointRouting).forEach(([originalWaypointId, journeyRouting]) => {
    const jpsWaypointId = waypointIdMapping[originalWaypointId];
    if (jpsWaypointId) {
      convertedRouting[jpsWaypointId] = {};
      
      // Convert journey IDs within this waypoint's routing
      Object.entries(journeyRouting).forEach(([originalJourneyId, routingConfig]) => {
        const jpsJourneyId = journeyIdMapping[originalJourneyId] || originalJourneyId;
        
        // Convert the destinations array target IDs
        const convertedRoutingConfig = {
          ...routingConfig,
          destinations: routingConfig.destinations?.map(dest => ({
            ...dest,
            target: targetIdMapping[dest.target] || dest.target
          })) || []
        };
        
        convertedRouting[jpsWaypointId][jpsJourneyId] = convertedRoutingConfig;
        
      
      });
    }
  });
  
  return convertedRouting;
}, [elements.waypoints, elements.exits, journeyConnections]); // Add elements.exits to dependencies

const updateWaypointRoutingOnConnection = useCallback((updatedConnections) => {
  const newWaypointRouting = { ...waypointRouting };
  let hasChanges = false;

  // Process each waypoint
  elements.waypoints.forEach(waypoint => {
    const waypointId = waypoint.id;
    
    // Find all journeys that have connections FROM this waypoint
    const journeysFromWaypoint = new Map();
    
    updatedConnections.forEach(connection => {
      const fromId = connection.from?.element?.id || connection.fromId;
      const toId = connection.to?.element?.id || connection.toId;
      const journeyId = connection.journeyId;
      
      if (fromId === waypointId && journeyId) {
        if (!journeysFromWaypoint.has(journeyId)) {
          journeysFromWaypoint.set(journeyId, []);
        }
        journeysFromWaypoint.get(journeyId).push(toId);
      }
    });
    
    // Update routing for each journey from this waypoint
    journeysFromWaypoint.forEach((destinations, journeyId) => {
      if (!newWaypointRouting[waypointId]) {
        newWaypointRouting[waypointId] = {};
      }
      
      // Split percentage evenly among actual outgoing connections
      const percentagePerDestination = Math.floor(100 / destinations.length);
      const remainder = 100 % destinations.length;
      
      newWaypointRouting[waypointId][journeyId] = {
        destinations: destinations.map((target, index) => ({
          target: target,
          percentage: percentagePerDestination + (index < remainder ? 1 : 0)
        }))
      };
      hasChanges = true;
    });
    
    // Clean up journeys that no longer have connections from this waypoint
    if (newWaypointRouting[waypointId]) {
      Object.keys(newWaypointRouting[waypointId]).forEach(journeyId => {
        if (!journeysFromWaypoint.has(journeyId)) {
          delete newWaypointRouting[waypointId][journeyId];
          hasChanges = true;
        }
      });
      
      // Remove empty waypoint entries
      if (Object.keys(newWaypointRouting[waypointId]).length === 0) {
        delete newWaypointRouting[waypointId];
        hasChanges = true;
      }
    }
  });
  
  if (hasChanges) {
    setWaypointRouting(newWaypointRouting);
  }
}, [waypointRouting, elements.waypoints]);
  
  const handleJourneyConnectionsChange = useCallback((newConnections) => {
  updateJourneyConnectionsWithHistory(newConnections);
  updateWaypointRoutingOnConnection(newConnections);  // ADD this line
}, [updateJourneyConnectionsWithHistory, updateWaypointRoutingOnConnection]);

  
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    
    const currentState = {
      elements: JSON.parse(JSON.stringify(elements)),
      journeyConnections: JSON.parse(JSON.stringify(journeyConnections))
    };
    setRedoStack(prev => [...prev, currentState]);
    
    setElements(previousState.elements);
    setJourneyConnections(previousState.journeyConnections || []);
    
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, elements, journeyConnections]);

  
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    
    const currentState = {
      elements: JSON.parse(JSON.stringify(elements)),
      journeyConnections: JSON.parse(JSON.stringify(journeyConnections))
    };
    setUndoStack(prev => [...prev, currentState]);
    
    setElements(nextState.elements);
    setJourneyConnections(nextState.journeyConnections || []);
    
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, elements, journeyConnections]);

  
  const handleClearAll = useCallback(() => {
    saveToHistory();
    
    setElements({
      boundaries: [],
      exits: [],
      distributions: [],
      waypoints: [],
      obstacles: [],
      journeys: []
    });
    setJourneyConnections([]);
    setWaypointRouting({});
    
    setUndoStack([]);
    setRedoStack([]);
    
    setResults(null);
    setError('');
    
    setSelectedDistribution(null);
    setShowDistributionEditor(false);
    
    
    setIsSimulationMode(false);
    resetTrajectoryData();
  }, [saveToHistory]);


  const handleParameterChange = useCallback((param, value) => {
    setSimulationParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

const getElementDisplayName = useCallback((element) => {
  const waypointIndex = elements.waypoints.findIndex(w => w.id === element.id);
  if (waypointIndex !== -1) return `wp${waypointIndex}`;
  
  const exitIndex = elements.exits.findIndex(e => e.id === element.id);
  if (exitIndex !== -1) return `ex${exitIndex}`;
  
  const distributionIndex = elements.distributions.findIndex(d => d.id === element.id);
  if (distributionIndex !== -1) return `dist${distributionIndex}`;
  
  return 'Unknown';
}, [elements]);

  
  const getModelParameters = useCallback((modelType) => {
  switch (modelType) {
    case 'CollisionFreeSpeedModel':
      return ['strength_neighbor_repulsion', 'range_neighbor_repulsion'];
    case 'CollisionFreeSpeedModelV2':
      return ['strength_neighbor_repulsion', 'range_neighbor_repulsion'];
    case 'GeneralizedCentrifugalForceModel':
      return ['mass', 'tau'];
    case 'SocialForceModel':
      return ['relaxation_time', 'agent_strength', 'agent_range'];
    case 'AnticipationVelocityModel':
      return ['T', 's0'];
    default:
      return [];
  }
}, []);

const getParameterInfo = useCallback((paramName) => {
  for (const model of availableModels) {
    const param = model.parameters.find(p => p.name === paramName);
    if (param) return param;
  }
  return { name: paramName, default: 0, description: paramName };
}, [availableModels]);

const handleLoadScenario = useCallback(async (jsonConfig, wktGeometry, scenarioName) => {
    try {
      // Clear existing elements first
      setElements({
        boundaries: [],
        exits: [],
        distributions: [],
        waypoints: [],
        obstacles: [],
        journeys: []
      });
      setJourneyConnections([]);
      
      // Create mock files to use with your existing parseCombinedFiles function
      const jsonBlob = new Blob([JSON.stringify(jsonConfig)], { type: 'application/json' });
      const wktBlob = new Blob([wktGeometry], { type: 'text/plain' });
      
      // Create mock file objects
      const mockJsonFile = new File([jsonBlob], 'config.json', { type: 'application/json' });
      const mockWktFile = new File([wktBlob], 'geometry.wkt', { type: 'text/plain' });
      
      const mockFiles = [mockJsonFile, mockWktFile];
      
      // Use your existing parseCombinedFiles function
      const success = await parseCombinedFiles(mockFiles);
      
      if (success) {
        // Debug the elements after parsing
        setTimeout(() => {
          setElements(prevElements => {
            return prevElements;
          });
        }, 100);
        
        setIsFileUpload(true);
      } else {
        alert('Failed to load scenario. Please try again.');
      }
    } catch (error) {
      alert('Error loading scenario: ' + error.message);
    }
  }, [parseCombinedFiles, setIsFileUpload]);

  // const canSaveScenario = elements.boundaries.length > 0 && 
  // elements.distributions.length > 0 && 
  // elements.distributions.every(d => d.parameters?.number > 0);
  const canSaveScenario = elements.boundaries.length > 0;

const fetchAvailableSeeds = useCallback(async (simulationId) => {
  try {
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    const response = await fetch(`${fetchURL}/simulation_seeds/${simulationId}`);
    
    if (response.ok) {
      const data = await response.json();
      setAvailableSeeds(data.seeds);
    }
  } catch (error) {
    console.error('Error fetching available seeds:', error);
  }
}, []);


const downloadSqliteFile = useCallback(async (simulationId, seed = null) => {
  try {
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    const url = seed 
      ? `${fetchURL}/simulation_sqlite/${simulationId}?seed=${seed}`
      : `${fetchURL}/simulation_sqlite/${simulationId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to download SQLite file');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    if (seed) {
      a.download = `simulation_seed_${seed}.sqlite`;
    } else {
      a.download = `simulation_all_seeds.zip`;
    }
    
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    
    // Refresh available seeds after download
    if (seed) {
      fetchAvailableSeeds(simulationId);
    } else {
      setAvailableSeeds([]);
    }
    
  } catch (error) {
    setError('Failed to download SQLite file: ' + error.message);
  }
}, [fetchAvailableSeeds]);  





const calculateAgentCounts = useCallback(() => {
  const counts = {
    waypoints: {},
    exits: {}
  };

  // Initialize counts
  elements.waypoints.forEach(wp => counts.waypoints[wp.id] = 0);
  elements.exits.forEach(exit => counts.exits[exit.id] = 0);

  // Track flow: nodeId -> journeyId -> destinationId -> flow amount
  const nodeFlow = {};

  // Helper function to get total flow for a node-journey combination
  const getTotalFlow = (nodeId, journeyId) => {
    if (!nodeFlow[nodeId] || !nodeFlow[nodeId][journeyId]) return 0;
    return Object.values(nodeFlow[nodeId][journeyId]).reduce((sum, flow) => sum + flow, 0);
  };

  // Helper function to get flow to specific destination
  const getFlowToDestination = (nodeId, journeyId, destinationId) => {
    return nodeFlow[nodeId]?.[journeyId]?.[destinationId] || 0;
  };

  // Helper function to set flow to specific destination
  const setFlowToDestination = (nodeId, journeyId, destinationId, amount) => {
    if (!nodeFlow[nodeId]) nodeFlow[nodeId] = {};
    if (!nodeFlow[nodeId][journeyId]) nodeFlow[nodeId][journeyId] = {};
    nodeFlow[nodeId][journeyId][destinationId] = amount;
  };

  // Helper function to distribute agents ensuring total is preserved (backend logic)
  const distributeAgentsWithRemainder = (totalAgents, destinations) => {
    if (destinations.length === 0) return [];
    
    const distribution = [];
    let remainingAgents = totalAgents;
    
    // Calculate total percentage
    const totalPercentage = destinations.reduce((sum, dest) => sum + dest.percentage, 0);
    
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      
      if (i === destinations.length - 1) {
        // Last destination gets all remaining agents (backend logic)
        distribution.push({
          target: dest.target,
          agents: remainingAgents
        });
      } else {
        // Calculate proportional assignment using round() like backend
        const percentage = totalPercentage > 0 ? dest.percentage / totalPercentage : 0;
        const agentsForDest = Math.round(totalAgents * percentage);
        const actualAgents = Math.min(agentsForDest, remainingAgents);
        
        distribution.push({
          target: dest.target,
          agents: actualAgents
        });
        
        remainingAgents -= actualAgents;
      }
    }
    
    return distribution;
  };

  // Initialize flow from distributions
  elements.distributions.forEach(dist => {
    const agentCount = dist.parameters?.number || 0;
    if (agentCount === 0) return;

    // Find journeys starting from this distribution
    const outgoingConnections = journeyConnections.filter(conn => conn.fromId === dist.id);
    outgoingConnections.forEach(conn => {
      // Set flow to the first destination (the waypoint/exit this distribution connects to)
      setFlowToDestination(dist.id, conn.journeyId, conn.toId, agentCount);
    });
  });

  // Process flow in multiple passes until stable
  let changed = true;
  let iterations = 0;
  const maxIterations = 20;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Process waypoints
    for (const waypoint of elements.waypoints) {
      const wpId = waypoint.id;
      
      // Calculate incoming flow by journey
      const incomingByJourney = {};
      
      // Sum up all flows coming TO this waypoint
      for (const conn of journeyConnections) {
        if (conn.toId === wpId) {
          const sourceId = conn.fromId;
          const journeyId = conn.journeyId;
          
          // Get flow from source to this waypoint
          const flowAmount = getFlowToDestination(sourceId, journeyId, wpId);
          if (flowAmount > 0) {
            if (!incomingByJourney[journeyId]) incomingByJourney[journeyId] = 0;
            incomingByJourney[journeyId] += flowAmount;
          }
        }
      }

      // Update waypoint count (sum of all journeys)
      const newWaypointCount = Object.values(incomingByJourney).reduce((sum, flow) => sum + flow, 0);
      if (counts.waypoints[wpId] !== newWaypointCount) {
        counts.waypoints[wpId] = newWaypointCount;
        changed = true;
      }

      // Calculate outgoing flow for each journey using backend logic
      for (const [journeyId, incomingFlow] of Object.entries(incomingByJourney)) {
        if (incomingFlow === 0) continue;

        // Find outgoing connections for this journey
        const outgoingConnections = journeyConnections.filter(conn => 
          conn.fromId === wpId && conn.journeyId === journeyId
        );

        if (outgoingConnections.length === 0) continue;

        // Apply waypoint routing with proper remainder handling
        const routingConfig = waypointRouting[wpId]?.[journeyId];
        
        if (routingConfig?.destinations && routingConfig.destinations.length > 0) {
          // Use backend-style distribution with remainder handling
          const agentDistribution = distributeAgentsWithRemainder(incomingFlow, routingConfig.destinations);
          
          // Set outgoing flows for each destination
          for (const dist of agentDistribution) {
            const currentFlow = getFlowToDestination(wpId, journeyId, dist.target);
            if (currentFlow !== dist.agents) {
              setFlowToDestination(wpId, journeyId, dist.target, dist.agents);
              changed = true;
            }
          }
        } else {
          // No routing - split equally with remainder handling
          const destinations = outgoingConnections.map(conn => ({ 
            target: conn.toId, 
            percentage: 100 / outgoingConnections.length 
          }));
          
          const agentDistribution = distributeAgentsWithRemainder(incomingFlow, destinations);
          
          // Set flows to each destination
          for (const dist of agentDistribution) {
            const currentFlow = getFlowToDestination(wpId, journeyId, dist.target);
            if (currentFlow !== dist.agents) {
              setFlowToDestination(wpId, journeyId, dist.target, dist.agents);
              changed = true;
            }
          }
        }
      }
    }

    // Process exits
    for (const exit of elements.exits) {
      const exitId = exit.id;
      
      // Calculate total incoming flow from all journeys and sources
      let totalIncoming = 0;
      
      for (const conn of journeyConnections) {
        if (conn.toId === exitId) {
          const sourceId = conn.fromId;
          const journeyId = conn.journeyId;
          const flowAmount = getFlowToDestination(sourceId, journeyId, exitId);
          totalIncoming += flowAmount;
        }
      }

      if (counts.exits[exitId] !== totalIncoming) {
        counts.exits[exitId] = totalIncoming;
        changed = true;
      }
    }
  }

  return counts;
}, [elements, journeyConnections, waypointRouting]);


// Update your runSimulation function:
const runSimulation = useCallback(async () => {
  let start_time = performance.now();
  
  const config = generateConfigFromDrawing(waypointRouting);
  if (!config.json || !config.wkt) {
    return;
  }

  // Convert waypoint routing IDs to match simulation config
  const convertedWaypointRouting = convertWaypointRoutingIds(waypointRouting, config.json);

  const hasFlowSpawning = elements.distributions.some(dist => 
    dist.parameters?.use_flow_spawning === true
  );

  setShowProgressModal(true);
  setError(''); 

  try {
    await startSimulation(
      config.json,
      config.wkt,
      {
        max_simulation_time: simulationParams.max_simulation_time,
        model_type: simulationParams.model_type,
        download_sqlite: true,
        number_of_simulations: numberOfSimulations,  
        base_seed: baseSeed,
        enable_flow_spawning: hasFlowSpawning
      },
      convertedWaypointRouting  // Use converted routing instead of original
    );

    let finish_time = performance.now();
  } catch (error) {
    console.error('Simulation error:', error);
    setError(error.message);
    setShowProgressModal(false);
  }
}, [generateConfigFromDrawing, simulationParams, startSimulation, downloadSqlite, numberOfSimulations, baseSeed, waypointRouting, convertWaypointRoutingIds,journeyConnections,elements.exits]);



const handleProgressCancel = useCallback(() => {
  cancelSimulation();
  setShowProgressModal(false);
}, [cancelSimulation]);



const handleProgressClose = useCallback(() => {
  setShowProgressModal(false);
  
  if (progressResults) {
    setResults(progressResults);

    // Fetch available seeds if SQLite download was requested
    if (downloadSqlite && simulationId) {
      fetchAvailableSeeds(simulationId);
    }

    if (progressResults.has_trajectory_data && progressResults.total_frames > 0) {
      setIsSimulationMode(true);
      setShowParametersPanel(false);
      setShowFilesPanel(false);
      setShowJourneyPanel(false);
      setShowElementsOverview(false);
      setCurrentViewMode('simulation');
      setDrawingMode('select');
      
      // Start loading ALL frames immediately in background
      if (simulationId) {
        // Load first chunk to start the simulation
        loadTrajectoryChunk(simulationId, 0, 50).then(() => {
          // Then continue loading the rest in background
          setTimeout(() => {
            loadAllTrajectory(100);
          }, 100);
        });
      }
    }
  }
}, [progressResults, simulationId, downloadSqlite, fetchAvailableSeeds, loadTrajectoryChunk, loadAllTrajectory]);


const handleSimulationClose = useCallback(() => {
  setIsSimulationMode(false);
  resetTrajectoryData(); // Changed from setTrajectoryData([])
  setResults(null);
  setCurrentViewMode('draw'); 

  // setTriggerAutoFit(true);
}, [resetTrajectoryData]);

  
  const handleViewModeChange = useCallback((mode) => {
  setCurrentViewMode(mode);
  if (mode === 'draw') {
    setIsSimulationMode(false);
  } else if (mode === 'simulation' && hasTrajectoryData) {
    setIsSimulationMode(true);
    setShowParametersPanel(false);
    setShowFilesPanel(false);
    setShowJourneyPanel(false);
    setShowElementsOverview(false);
  }
}, [hasTrajectoryData]);

  
  const toggleParametersPanel = useCallback(() => {
    setShowParametersPanel(prev => !prev);
    setShowFilesPanel(false);
    setShowJourneyPanel(false);
    setShowElementsOverview(false);
  }, []);

  const toggleFilesPanel = useCallback(() => {
    setShowFilesPanel(prev => !prev);
    setShowParametersPanel(false);
    setShowJourneyPanel(false);
    setShowElementsOverview(false);
  }, []);

  
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  
  const hasSimulationData = trajectoryData.length > 0 && results;

  useEffect(() => {
  const fetchModels = async () => {
    try {
      const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
      const response = await fetch(`${fetchURL}/models`);
      const data = await response.json();
      setAvailableModels(data.models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };
  
  fetchModels();
}, []);

const computeJourneyPaths = async (walkableAreaWkt, journeyConnections, elements) => {
  try {
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    const response = await fetch(`${fetchURL}/compute_journey_paths`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walkable_area_wkt: walkableAreaWkt,
        journey_connections: journeyConnections,
        elements: elements
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error computing journey paths:', error);
    throw error;
  }
};

const generateWalkableAreaWkt = (boundaries) => {
  if (boundaries.length === 0) return '';
  
  // Simple implementation - you might need to adjust based on your geometry structure
  const boundary = boundaries[0]; // Assuming single walkable area
  const coordsString = boundary.points.map(p => `${p.x} ${p.y}`).join(', ');
  return `POLYGON((${coordsString}, ${boundary.points[0].x} ${boundary.points[0].y}))`;
};

const computeShortestPaths = useCallback(async () => {
  if (elements.boundaries.length === 0 || journeyConnections.length === 0) {
    setError("Need walkable area and journey connections to compute paths");
    return;
  }

  
  try {
    // Calculate bounds (same as before)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
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
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Transform to simulation coordinates (same as before)
    const transformToSimulationCoordinates = (element, bounds) => {
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      
      if (element.center) {
        return {
          ...element,
          center: {
            x: (element.center.x - centerX) * SCALE_FACTOR,
            y: (element.center.y - centerY) * SCALE_FACTOR
          }
        };
      } else {
        return {
          ...element,
          points: element.points.map(point => ({
            x: (point.x - centerX) * SCALE_FACTOR,
            y: (point.y - centerY) * SCALE_FACTOR
          }))
        };
      }
    };
    
    // ADD THIS: Function to transform simulation coordinates back to frontend coordinates
    const transformFromSimulationCoordinates = (simX, simY) => {
      return [
        (simX / SCALE_FACTOR) + centerX,
        (simY / SCALE_FACTOR) + centerY
      ];
    };
    
    // Generate WKT (same as before)
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
    
    const walkableAreaWkt = generateWKT();
    
    const transformedElements = {
      boundaries: elements.boundaries.map(b => transformToSimulationCoordinates(b, bounds)),
      exits: elements.exits.map(e => transformToSimulationCoordinates(e, bounds)),
      distributions: elements.distributions.map(d => transformToSimulationCoordinates(d, bounds)),
      waypoints: elements.waypoints.map(w => transformToSimulationCoordinates(w, bounds)),
      obstacles: (elements.obstacles || []).map(o => transformToSimulationCoordinates(o, bounds))
    };
    
    const result = await computeJourneyPaths(walkableAreaWkt, journeyConnections, transformedElements);
    
    if (result.success) {
      // TRANSFORM WAYPOINTS BACK TO FRONTEND COORDINATES
      const transformedConnections = result.journey_connections.map(connection => {
        if (connection.routingMode === 'shortest-path' && connection.waypoints) {
          return {
            ...connection,
            waypoints: connection.waypoints.map(waypoint => 
              transformFromSimulationCoordinates(waypoint[0], waypoint[1])
            )
          };
        }
        return connection;
      });
      
      console.log('Transformed journey connections back to frontend coords:', transformedConnections);
      updateJourneyConnectionsWithHistory(transformedConnections);
      setError('');
    } else {
      setError(`Path computation failed: ${result.errors.join(', ')}`);
    }
  } catch (error) {
    console.error('Error in computeShortestPaths:', error);
    setError(`Error computing shortest paths: ${error.message}`);
  }
}, [elements, journeyConnections, updateJourneyConnectionsWithHistory, SCALE_FACTOR]);


useEffect(() => {
  if (useShortestPaths && journeyConnections.length > 0 && !dragState.isDragging) {
    // const timeoutId = setTimeout(() => {
      computeShortestPaths();
    // }, 200);
    
    // return () => clearTimeout(timeoutId);
  }
}, [
  dragState.isDragging ? null : elements.obstacles,
  dragState.isDragging ? null : elements.waypoints,
  dragState.isDragging ? null : elements.exits,
  dragState.isDragging ? null : elements.distributions,
  useShortestPaths,
  dragState.isDragging
]);

useEffect(() => {
  if (isSimulationMode && trajectoryData && trajectoryData.length > 0 && (colorByDistribution || colorByExit)) {
    processAgentColors();
  }
}, [isSimulationMode, colorByDistribution, colorByExit, processAgentColors, trajectoryData]);

const computeHeatmap = useCallback(async () => {
  if (!simulationId || !results) {
    console.error('DEBUG: Missing simulationId or results', { simulationId, results });
    return;
  }
  
  // Debug: Check what we have
  console.log('DEBUG: Computing heatmap with:', {
    simulationId,
    sqlite_file: results.sqlite_file,
    geometry_wkt: results.geometry_wkt ? results.geometry_wkt.substring(0, 100) + '...' : 'MISSING'
  });
  
  try {
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    const requestBody = {
      sqlite_file: results.primary_sqlite_file || results.sqlite_file,
      walkable_area_wkt: results.geometry_wkt,
      grid_size: 0.3,
      gaussian_width: 0.5
    };
    
    console.log('DEBUG: Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${fetchURL}/compute_heatmap`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('DEBUG: Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('DEBUG: Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('DEBUG: Heatmap data received:', {
      success: data.success,
      rows: data.shape?.rows,
      cols: data.shape?.cols,
      bounds: data.bounds
    });
    
    setHeatmapData(data);
  } catch (error) {
    console.error('DEBUG: Heatmap computation failed:', error);
    setError('Failed to compute density heatmap: ' + error.message);
  }
}, [simulationId, results]);

const handleChatbotGeometry = useCallback(async (jsonConfig, wktData) => {
  try {
    // parseCombinedFiles is already available from the hook at component level
    // We need to create a similar function to parseCombinedData
    
    // Clear existing elements first
    setElements({
      boundaries: [],
      exits: [],
      distributions: [],
      waypoints: [],
      obstacles: [],
      journeys: []
    });
    setJourneyConnections([]);
    
    // Create mock files to use with parseCombinedFiles
    const jsonBlob = new Blob([JSON.stringify(jsonConfig)], { type: 'application/json' });
    const wktBlob = new Blob([wktData], { type: 'text/plain' });
    
    const mockJsonFile = new File([jsonBlob], 'chatbot_config.json', { type: 'application/json' });
    const mockWktFile = new File([wktBlob], 'chatbot_geometry.wkt', { type: 'text/plain' });
    
    const mockFiles = [mockJsonFile, mockWktFile];
    
    // Use the existing parseCombinedFiles function
    const success = await parseCombinedFiles(mockFiles);
    
    if (success) {
      setIsFileUpload(true);
      setShowChatbot(false); // Close chatbot after successful generation
      
      // The isFileUpload state will trigger the autofit in DrawingCanvas
      // Give it a moment to process
      setTimeout(() => {
        console.log('Geometry loaded from chatbot successfully');
      }, 100);
    } else {
      alert('Failed to load generated geometry. Please try again.');
    }
  } catch (error) {
    console.error('Error loading chatbot geometry:', error);
    alert('Failed to load generated geometry: ' + error.message);
  }
}, [parseCombinedFiles, setElements, setJourneyConnections, setIsFileUpload]);

const handleShortestPathToggle = useCallback((enabled) => {
  setUseShortestPaths(enabled);
  
  if (!enabled) {
    // When disabling: Remove auto-journeys, clear shortest path data from manual journeys
    const clearedConnections = journeyConnections
      .filter(connection => connection.journeyId !== 'AUTO_J1') // Remove auto-journeys
      .map(connection => {
        // Clear shortest path data from remaining (manual) journeys
        const { waypoints, routingMode, ...cleanConnection } = connection;
        return cleanConnection;
      });
    
    updateJourneyConnectionsWithHistory(clearedConnections);
    
  } else {
    // When enabling: Create auto-journeys for distributions without journeys, then compute paths
    
    if (elements.distributions.length === 0 || elements.exits.length === 0) {
      return;
    }
    
    // Find distributions that don't have ANY outgoing connections (manual or auto)
    const distributionsWithoutJourneys = elements.distributions.filter(distribution => {
      return !journeyConnections.some(conn => conn.fromId === distribution.id);
    });
    
    if (distributionsWithoutJourneys.length > 0) {
      // Create auto-journeys for distributions without any journeys
      const autoConnections = [...journeyConnections];
      
      distributionsWithoutJourneys.forEach(distribution => {
        // Find closest exit
        let closestExit = null;
        let minDistance = Infinity;
        
        elements.exits.forEach(exit => {
          const distCenter = {
            x: distribution.points.reduce((sum, p) => sum + p.x, 0) / distribution.points.length,
            y: distribution.points.reduce((sum, p) => sum + p.y, 0) / distribution.points.length
          };
          
          const exitCenter = {
            x: exit.points.reduce((sum, p) => sum + p.x, 0) / exit.points.length,
            y: exit.points.reduce((sum, p) => sum + p.y, 0) / exit.points.length
          };
          
          const distance = Math.sqrt(
            Math.pow(distCenter.x - exitCenter.x, 2) + 
            Math.pow(distCenter.y - exitCenter.y, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            closestExit = exit;
          }
        });
        
        if (closestExit) {
          autoConnections.push({
            id: `auto_connection_${Date.now()}_${autoConnections.length}`,
            from: { type: 'distribution', element: distribution },
            to: { type: 'exit', element: closestExit },
            fromId: distribution.id,
            toId: closestExit.id,
            journeyId: 'AUTO_J1',
            journeyColor: '#22c55e',
            routingMode: 'shortest-path'
          });
        }
      });
      
      // Update with new auto-journeys and compute paths
      updateJourneyConnectionsWithHistory(autoConnections);
      computeShortestPaths();
      
    } else {
      // No new auto-journeys needed, just compute shortest paths for existing journeys
      if (journeyConnections.length > 0) {
        computeShortestPaths();
      }
    }
  }
}, [
  journeyConnections, 
  updateJourneyConnectionsWithHistory, 
  elements.distributions, 
  elements.exits, 
  computeShortestPaths
]);

return (
    <div className="canvas-container-fullscreen">
      {}
      <div className="top-toolbar">
        <div className="toolbar-section">
  <button 
    className={`toolbar-btn ${showParametersPanel ? 'active' : ''}`}
    onClick={toggleParametersPanel}
  >
    Settings
  </button>
  
  
</div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-section">
          <button 
            className={`toolbar-btn ${drawingMode === 'select' ? 'active' : ''}`}
            onClick={() => setDrawingMode('select')}
          >
            Select
          </button>
          
          <button 
            className="toolbar-btn toolbar-btn-danger"
            onClick={handleClearAll}
          >
            Clear All
          </button>
        </div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-section">
          <button 
            className={`toolbar-btn ${drawingMode === 'walkablearea' ? 'active' : ''}`}
            onClick={() => setDrawingMode('walkablearea')}
          >
            Boundary
          </button>
          <button 
            className={`toolbar-btn ${drawingMode === 'exit' ? 'active' : ''}`}
            onClick={() => setDrawingMode('exit')}
          >
            Exit
          </button>
          <button 
            className={`toolbar-btn ${drawingMode === 'distribution' ? 'active' : ''}`}
            onClick={() => setDrawingMode('distribution')}
          >
            Start Area
          </button>
          <button 
            className={`toolbar-btn ${drawingMode === 'obstacle' ? 'active' : ''}`}
            onClick={() => setDrawingMode('obstacle')}
          >
            Obstacle
          </button>
          <button 
            className={`toolbar-btn ${drawingMode === 'waypoint' ? 'active' : ''}`}
            onClick={() => setDrawingMode('waypoint')}
          >
            Waypoint
          </button>
          <button 
            className={`toolbar-btn ${drawingMode === 'journey' ? 'active' : ''}`}
            onClick={() => { setDrawingMode('journey'); setShowJourneyPanel(true); setShowFilesPanel(false); setShowParametersPanel(false); setShowElementsOverview(false); }}
          >
            Journey
          </button>

          
        </div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-section">
          <button 
            onClick={runSimulation}
            disabled={elements.exits.length === 0 || isLoading || elements.distributions.some(d => !d.parameters?.number)}
            className={`toolbar-btn toolbar-btn-primary ${isLoading ? 'loading' : ''}`}
          >
            {isLoading && <span className="spinner"></span>}
            {isLoading ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
        
        <div className="toolbar-section">
          <div className="mode-switcher">
            <button 
              className={`mode-switcher-button ${currentViewMode === 'draw' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('draw')}
            >
              Draw Mode
            </button>
            <button 
              className={`mode-switcher-button ${currentViewMode === 'simulation' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('simulation')}
              disabled={!hasSimulationData}
            >
              Simulation Mode
            </button>
          </div>
        </div>
        
      </div>
          {}
<SimulationProgressModal
  isOpen={showProgressModal}
  progress={progress}
  onCancel={handleProgressCancel}
  onClose={handleProgressClose}
/>
      {}
     
      <div className={`parameters-panel ${showParametersPanel ? 'open' : ''}`}>
  <div className="parameters-panel-header">
    <h2 className="parameters-panel-title">Simulation Settings</h2>
  </div>
  <div className="parameters-panel-content">
    {/* General Parameters Group */}
    <div className="parameter-group">
      <h3 className="parameter-group-title">General Parameters</h3>
      <div className="form-group">
        <label className="form-label">Max Time (seconds):</label>
        <input
          type="number"
          min="10"
          max="1800"
          step="10"
          value={simulationParams.max_simulation_time}
          onChange={(e) => handleParameterChange('max_simulation_time', parseFloat(e.target.value))}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          <input
            type="checkbox"
            checked={downloadSqlite}
            onChange={(e) => setDownloadSqlite(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Download SQLite trajectory file after simulation
        </label>
        
      </div>
    </div>

    {/* Model Configuration Group */}
    <div className="parameter-group">
      <h3 className="parameter-group-title">Model Configuration</h3>
      <div className="form-group">
        <label className="form-label">Model Name:</label>
        <select
          value={simulationParams.model_type}
          onChange={(e) => handleParameterChange('model_type', e.target.value)}
          className="form-select"
        >
          <option value="CollisionFreeSpeedModel">Collision Free Speed Model</option>
          <option value="CollisionFreeSpeedModelV2">Collision Free Speed Model V2 (Advanced)</option>
          <option value="GeneralizedCentrifugalForceModel">Generalized Centrifugal Force Model</option>
          <option value="SocialForceModel">Social Force Model</option>
          <option value="AnticipationVelocityModel">Anticipation Velocity Model</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Model Parameters:</label>
        <div className="model-parameters">
          {getModelParameters(simulationParams.model_type).map(paramName => {
            const paramInfo = getParameterInfo(paramName);
            return (
              <div key={paramName} className="parameter-item">
                <label className="parameter-label">
                  {paramInfo.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simulationParams[paramName]}
                  onChange={(e) => handleParameterChange(paramName, parseFloat(e.target.value))}
                  className="parameter-input"
                />
                <span className="parameter-description">
                  {paramInfo.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>

   
    

    {results && results.sqlite_download_available && downloadSqlite && (
      <div style={{ marginTop: '12px' }}>
        {availableSeeds.length > 0 && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <strong>Available Seeds:</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {availableSeeds.filter(s => s.available).map(seedInfo => (
                <button
                  key={seedInfo.seed}
                  onClick={() => downloadSqliteFile(simulationId, seedInfo.seed)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  Download Seed {seedInfo.seed}
                </button>
              ))}
            </div>
            {availableSeeds.filter(s => s.available).length > 1 && (
              <button
                onClick={() => downloadSqliteFile(simulationId)}
                className="btn btn-primary"
                style={{ fontSize: '0.875rem', padding: '6px 12px' }}
              >
                Download All Seeds (ZIP)
              </button>
            )}
          </>
        )}
        <p style={{ 
          fontSize: '0.75rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          Download trajectory data files named by their random seed
        </p>
      </div>
    )}
  </div>
</div>
{/* Elements Panel */}
<div className={`parameters-panel ${showElementsOverview ? 'open' : ''}`}>
  <div className="parameters-panel-header">
    <h2 className="parameters-panel-title">Elements Manager</h2>
  </div>
  <div className="parameters-panel-content">
    <div className="sidebar-section">
  <div className='sidebar-section-header'>
  <h3 className="sidebar-section-title">Boundaries ({elements.boundaries.length})</h3>
  <button 
      className={`visibility-toggle ${elementVisibility.boundaries ? 'visible' : 'hidden'}`}
      onClick={() => setElementVisibility(prev => ({...prev, boundaries: !prev.boundaries}))}
      title={elementVisibility.boundaries ? 'Hide boundaries' : 'Show boundaries'}
    >
      {elementVisibility.boundaries ? '👁️' : '👁️‍🗨️'}
    </button>
  </div>
  <div className="element-list">
    {elements.boundaries.map((boundary, index) => (
      <div key={boundary.id} className="element-item">
        <span 
        className="element-name clickable"
        onClick={() => setHighlightedElement(highlightedElement?.id === boundary.id ? null : boundary)}
        onMouseEnter={() => setHoveredElement(boundary)}
        onMouseLeave={() => setHoveredElement(null)}
        title="Click to highlight on canvas"
      >
        Boundary {index + 1}
      </span>
        <div className="element-actions">
          <button 
            className={`element-visibility-toggle ${individualElementVisibility[boundary.id] === false ? 'hidden' : 'visible'}`}
            onClick={() => setIndividualElementVisibility(prev => ({
              ...prev,
              [boundary.id]: prev[boundary.id] === false ? true : false
            }))}
            title={individualElementVisibility[boundary.id] === false ? 'Show element' : 'Hide element'}
          >
            {individualElementVisibility[boundary.id] === false ? '👁️‍🗨️' : '👁️'}
          </button>
          <button 
            className="element-delete-btn"
            onClick={() => {
              const newElements = { ...elements };
              newElements.boundaries = newElements.boundaries.filter(b => b.id !== boundary.id);
              if (highlightedElement?.id === boundary.id) setHighlightedElement(null);
              updateElementsWithHistory(newElements);
            }}
            title="Delete boundary"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    {elements.boundaries.length === 0 && (
      <div className="element-empty">No boundaries drawn</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className='sidebar-section-header'>
  <h3 className="sidebar-section-title">Exits ({elements.exits.length})</h3>
  <button 
      className={`visibility-toggle ${elementVisibility.exits ? 'visible' : 'hidden'}`}
      onClick={() => setElementVisibility(prev => ({...prev, exits: !prev.exits}))}
      title={elementVisibility.exits ? 'Hide exits' : 'Show exits'}
    >
      {elementVisibility.exits ? '👁️' : '👁️‍🗨️'}
    </button>
  </div>
  <div className="element-list">
    {elements.exits.map((exit, index) => (
      <div key={exit.id} className="element-item">
        <span 
        className="element-name clickable"
        onClick={() => setHighlightedElement(highlightedElement?.id === exit.id ? null : exit)}
        onMouseEnter={() => setHoveredElement(exit)}
        onMouseLeave={() => setHoveredElement(null)}
        title="Click to highlight on canvas"
      >
        Exit {index}
      </span>
        <div className="element-actions">
          <button 
            className={`element-visibility-toggle ${individualElementVisibility[exit.id] === false ? 'hidden' : 'visible'}`}
            onClick={() => setIndividualElementVisibility(prev => ({
              ...prev,
              [exit.id]: prev[exit.id] === false ? true : false
            }))}
            title={individualElementVisibility[exit.id] === false ? 'Show element' : 'Hide element'}
          >
            {individualElementVisibility[exit.id] === false ? '👁️‍🗨️' : '👁️'}
          </button>
          <button 
            className="element-delete-btn"
            onClick={() => {
              const newElements = { ...elements };
              const exitToDelete = newElements.exits.find(e => e.id === exit.id);
              newElements.exits = newElements.exits.filter(e => e.id !== exit.id);
              
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
              
              // Delete all journey connections involving this exit
              const filteredConnections = journeyConnections.filter(connection => {
                const fromId = connection.from?.element?.id || connection.fromId;
                const toId = connection.to?.element?.id || connection.toId;
                return fromId !== exitToDelete.id && toId !== exitToDelete.id;
              });
              
              if (highlightedElement?.id === exit.id) setHighlightedElement(null);
              updateElementsWithHistory(newElements);
              updateJourneyConnectionsWithHistory(filteredConnections);
              setWaypointRouting(newWaypointRouting);
            }}
            title="Delete exit"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    {elements.exits.length === 0 && (
      <div className="element-empty">No exits created</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className='sidebar-section-header'>
    <h3 className="sidebar-section-title">Distributions ({elements.distributions.length})</h3>
    <button 
      className={`visibility-toggle ${elementVisibility.distributions ? 'visible' : 'hidden'}`}
      onClick={() => setElementVisibility(prev => ({...prev, distributions: !prev.distributions}))}
      title={elementVisibility.distributions ? 'Hide start areas' : 'Show start areas'}
    >
      {elementVisibility.distributions ? '👁️' : '👁️‍🗨️'}
    </button>
  </div>
  <div className="element-list">
    {elements.distributions.map((dist, index) => (
      <div key={dist.id} className="element-item">
        <span 
        className="element-name clickable"
        onClick={() => setHighlightedElement(highlightedElement?.id === dist.id ? null : dist)}
        onMouseEnter={() => setHoveredElement(dist)}
        onMouseLeave={() => setHoveredElement(null)}
        title="Click to highlight on canvas"
      >
        Distribution {index}
      </span>
        <div className="element-actions">
          <button 
            className={`element-visibility-toggle ${individualElementVisibility[dist.id] === false ? 'hidden' : 'visible'}`}
            onClick={() => setIndividualElementVisibility(prev => ({
              ...prev,
              [dist.id]: prev[dist.id] === false ? true : false
            }))}
            title={individualElementVisibility[dist.id] === false ? 'Show element' : 'Hide element'}
          >
            {individualElementVisibility[dist.id] === false ? '👁️‍🗨️' : '👁️'}
          </button>
          <button 
            className="element-delete-btn"
            onClick={() => {
              const newElements = { ...elements };
              newElements.distributions = newElements.distributions.filter(d => d.id !== dist.id);
              if (highlightedElement?.id === dist.id) setHighlightedElement(null);
              updateElementsWithHistory(newElements);
            }}
            title="Delete start area"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    {elements.distributions.length === 0 && (
      <div className="element-empty">No start areas created</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className='sidebar-section-header'>
    <h3 className="sidebar-section-title">Waypoints ({elements.waypoints.length})</h3>
    <button 
      className={`visibility-toggle ${elementVisibility.waypoints ? 'visible' : 'hidden'}`}
      onClick={() => setElementVisibility(prev => ({...prev, waypoints: !prev.waypoints}))}
      title={elementVisibility.waypoints ? 'Hide waypoints' : 'Show waypoints'}
    >
      {elementVisibility.waypoints ? '👁️' : '👁️‍🗨️'}
    </button>
  </div>
  <div className="element-list">
    {elements.waypoints.map((waypoint, index) => (
      <div key={waypoint.id} className="element-item">
        <span 
        className="element-name clickable"
        onClick={() => setHighlightedElement(highlightedElement?.id === waypoint.id ? null : waypoint)}
        onMouseEnter={() => setHoveredElement(waypoint)}
        onMouseLeave={() => setHoveredElement(null)}
        title="Click to highlight on canvas"
      >
        Waypoint {index} (r: {waypoint.radius || 23.0})
      </span>
        <div className="element-actions">
          <button 
            className={`element-visibility-toggle ${individualElementVisibility[waypoint.id] === false ? 'hidden' : 'visible'}`}
            onClick={() => setIndividualElementVisibility(prev => ({
              ...prev,
              [waypoint.id]: prev[waypoint.id] === false ? true : false
            }))}
            title={individualElementVisibility[waypoint.id] === false ? 'Show element' : 'Hide element'}
          >
            {individualElementVisibility[waypoint.id] === false ? '👁️‍🗨️' : '👁️'}
          </button>
          <button 
            className="element-delete-btn"
            onClick={() => {
              const newElements = { ...elements };
              // const waypointToDelete = newElements.waypoints.find(w => w.id === waypoint.id);
              newElements.waypoints = newElements.waypoints.filter(w => w.id !== waypoint.id);
              
              // Remove journey connections
              const newConnections = journeyConnections.filter(
                conn => conn.fromId !== waypoint.id && conn.toId !== waypoint.id
              );
              
              // Clean up waypoint routing
              const newWaypointRouting = { ...waypointRouting };
              delete newWaypointRouting[waypoint.id];
              
              // Remove references to this waypoint from other waypoints' routing
              Object.keys(newWaypointRouting).forEach(otherWaypointId => {
                Object.keys(newWaypointRouting[otherWaypointId]).forEach(journeyId => {
                  if (newWaypointRouting[otherWaypointId][journeyId].destinations) {
                    newWaypointRouting[otherWaypointId][journeyId].destinations = 
                      newWaypointRouting[otherWaypointId][journeyId].destinations.filter(
                        dest => dest.target !== waypoint.id
                      );
                  }
                });
              });
              
              if (highlightedElement?.id === waypoint.id) setHighlightedElement(null);
              updateElementsWithHistory(newElements);
              updateJourneyConnectionsWithHistory(newConnections);
              setWaypointRouting(newWaypointRouting); // Add this line
            }}
            title="Delete waypoint"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    {elements.waypoints.length === 0 && (
      <div className="element-empty">No waypoints created</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className='sidebar-section-header'>
  <h3 className="sidebar-section-title">Obstacles ({elements.obstacles ? elements.obstacles.length : 0})</h3>
  <button 
      className={`visibility-toggle ${elementVisibility.obstacles ? 'visible' : 'hidden'}`}
      onClick={() => setElementVisibility(prev => ({...prev, obstacles: !prev.obstacles}))}
      title={elementVisibility.obstacles ? 'Hide obstacles' : 'Show obstacles'}
    >
      {elementVisibility.obstacles ? '👁️' : '👁️‍🗨️'}
    </button>
  </div>
  <div className="element-list">
    {(elements.obstacles || []).map((obstacle, index) => (
      <div key={obstacle.id} className="element-item">
        <span 
        className="element-name clickable"
        onClick={() => setHighlightedElement(highlightedElement?.id === obstacle.id ? null : obstacle)}
        onMouseEnter={() => setHoveredElement(obstacle)}
        onMouseLeave={() => setHoveredElement(null)}
        title="Click to highlight on canvas"
      >
        Obstacle {index}
      </span>
        <div className="element-actions">
          <button 
            className={`element-visibility-toggle ${individualElementVisibility[obstacle.id] === false ? 'hidden' : 'visible'}`}
            onClick={() => setIndividualElementVisibility(prev => ({
              ...prev,
              [obstacle.id]: prev[obstacle.id] === false ? true : false
            }))}
            title={individualElementVisibility[obstacle.id] === false ? 'Show element' : 'Hide element'}
          >
            {individualElementVisibility[obstacle.id] === false ? '👁️‍🗨️' : '👁️'}
          </button>
          <button 
            className="element-delete-btn"
            onClick={() => {
              const newElements = { ...elements };
              newElements.obstacles = newElements.obstacles.filter(o => o.id !== obstacle.id);
              if (highlightedElement?.id === obstacle.id) setHighlightedElement(null);
              updateElementsWithHistory(newElements);
            }}
            title="Delete obstacle"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    {(!elements.obstacles || elements.obstacles.length === 0) && (
      <div className="element-empty">No obstacles created</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className="sidebar-section-header">
<h3 className="sidebar-section-title">Journey Connections ({journeyConnections.length})</h3>
<button 
  className={`visibility-toggle ${elementVisibility.journeyConnections ? 'visible' : 'hidden'}`}
  onClick={() => setElementVisibility(prev => ({...prev, journeyConnections: !prev.journeyConnections}))}
  title={elementVisibility.journeyConnections ? 'Hide journey connections' : 'Show journey connections'}
>
  {elementVisibility.journeyConnections ? '👁️' : '👁️‍🗨️'}
</button>
</div>
  <div className="element-list">
    {journeyConnections.map((connection, index) => {
      const fromElement = [...elements.waypoints, ...elements.exits, ...elements.distributions]
        .find(el => el.id === connection.fromId);
      const toElement = [...elements.waypoints, ...elements.exits, ...elements.distributions]
        .find(el => el.id === connection.toId);
      
      const connectionId = `${connection.journeyId}_${connection.fromId}_${connection.toId}`;
      const isHighlighted = highlightedElement?.connectionId === connectionId;
      
      return (
        <div key={index} className={`element-item ${isHighlighted ? 'highlighted' : ''}`}>
          <span 
            className="element-name clickable"
            onClick={() => {
              const connectionObj = {
                ...connection,
                connectionId: connectionId,
                type: 'journeyConnection'
              };
              setHighlightedElement(isHighlighted ? null : connectionObj);
            }}
            onMouseEnter={() => {
              const connectionObj = {
                ...connection,
                connectionId: connectionId,
                type: 'journeyConnection'
              };
              setHoveredElement(connectionObj);
            }}
            onMouseLeave={() => setHoveredElement(null)}
            title="Click to highlight on canvas"
          >
            {connection.journeyId}: {fromElement ? getElementDisplayName(fromElement) : 'Unknown'} → {toElement ? getElementDisplayName(toElement) : 'Unknown'}
          </span>
          <div className="element-actions">
            <button 
          className="element-delete-btn"
          onClick={() => {
            // Check if this connection is from a distribution in a set
            const fromId = connection.from?.element?.id || connection.fromId;
            const distributionSetId = getDistributionSet && getDistributionSet(fromId);
            
            if (distributionSetId) {
              // Delete ALL connections from distributions in this set
              const setDistributions = getDistributionsInSet && getDistributionsInSet(distributionSetId);
              const setDistributionIds = setDistributions.map(d => d.id);
              
              const newConnections = journeyConnections.filter(conn => {
                const connFromId = conn.from?.element?.id || conn.fromId;
                return !setDistributionIds.includes(connFromId);
              });
              
              updateJourneyConnectionsWithHistory(newConnections);
              // showErrorToast && showErrorToast(`Deleted all connections for distribution set`);
            } else {
              // Original single connection deletion
              const newConnections = journeyConnections.filter((_, i) => i !== index);
              if (isHighlighted) setHighlightedElement(null);
              updateJourneyConnectionsWithHistory(newConnections);
            }
          }}
          title="Delete journey connection"
        >
          ×
        </button>
          </div>
        </div>
      );
    })}
    {journeyConnections.length === 0 && (
      <div className="element-empty">No journey connections created</div>
    )}
  </div>
</div>

<div className="sidebar-section">
  <div className='sidebar-section-header'>
    <h3 className="sidebar-section-title">Distribution Sets ({Object.keys(distributionSets).length})</h3>
    <button 
      className="sidebar-btn-small"
      onClick={() => setShowSetManager(true)}
    >
      Add Set
    </button>
  </div>
  <div className="element-list">
    {Object.entries(distributionSets).map(([setId, set]) => (
      <div key={setId} className="element-item">
        <span 
          className="element-name clickable"
          onClick={() => {
            // Toggle selection of this set for editing
            setSelectedSet(selectedSet === setId ? null : setId);
          }}
          title="Click to manage distributions in this set"
        >
          {set.name} ({set.distributionIds.length} distributions)
        </span>
        <div className="element-actions">
          <button 
            className="element-delete-btn"
            onClick={() => {
              // Delete all connections from distributions in this set
              const setDistributionIds = set.distributionIds;
              const filteredConnections = journeyConnections.filter(connection => {
                const fromId = connection.from?.element?.id || connection.fromId;
                return !setDistributionIds.includes(fromId);
              });
              
              // Delete the set
              const newSets = { ...distributionSets };
              delete newSets[setId];
              setDistributionSets(newSets);
              updateJourneyConnectionsWithHistory(filteredConnections);
              
              if (selectedSet === setId) {
                setSelectedSet(null);
              }
            }}
            title="Delete set and all its connections"
          >
            ×
          </button>
        </div>
      </div>
    ))}
    
    {/* Show distributions management when a set is selected */}
    {selectedSet && distributionSets[selectedSet] && (
      <div className="set-management-expanded">
        <div className="set-management-header">
          <strong>Managing: {distributionSets[selectedSet].name}</strong>
        </div>
        
        {/* Current distributions in set */}
        <div className="set-distributions-list">
          <h4>Distributions in set:</h4>
          {distributionSets[selectedSet].distributionIds.map(distId => {
            const dist = elements.distributions.find(d => d.id === distId);
            const distIndex = elements.distributions.findIndex(d => d.id === distId);
            return dist ? (
              <div key={distId} className="set-distribution-item">
                <span>Distribution {distIndex}</span>
                <button
                  onClick={() => {
                    // Remove connections from this distribution
                    const filteredConnections = journeyConnections.filter(connection => {
                      const fromId = connection.from?.element?.id || connection.fromId;
                      return fromId !== distId;
                    });
                    
                    // Remove from set
                    const newSets = { ...distributionSets };
                    newSets[selectedSet].distributionIds = newSets[selectedSet].distributionIds.filter(id => id !== distId);
                    setDistributionSets(newSets);
                    updateJourneyConnectionsWithHistory(filteredConnections);
                  }}
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
            ) : null;
          })}
        </div>

        {/* Add distributions to set */}
        <div className="add-to-set">
          <h4>Add distribution:</h4>
          <select
            onChange={(e) => {
              if (e.target.value) {
                const distId = e.target.value;
                const newSets = { ...distributionSets };
                
                // Remove from other sets first
                Object.keys(newSets).forEach(otherSetId => {
                  newSets[otherSetId].distributionIds = newSets[otherSetId].distributionIds.filter(id => id !== distId);
                });
                
                // Add to this set
                if (!newSets[selectedSet].distributionIds.includes(distId)) {
                  newSets[selectedSet].distributionIds.push(distId);
                }
                
                setDistributionSets(newSets);
                e.target.value = '';
              }
            }}
            className="form-select"
          >
            <option value="">Select distribution...</option>
            {elements.distributions
              .filter(dist => !distributionSets[selectedSet].distributionIds.includes(dist.id))
              .map((dist, index) => (
                <option key={dist.id} value={dist.id}>
                  Distribution {elements.distributions.findIndex(d => d.id === dist.id)}
                </option>
              ))
            }
          </select>
        </div>
      </div>
    )}
    
    {Object.keys(distributionSets).length === 0 && (
      <div className="element-empty">No distribution sets created</div>
    )}
  </div>
</div>

  {/* Validation and Results */}
    {(elements.distributions.length > 0 || elements.exits.length > 0 || elements.waypoints.length > 0 || (elements.obstacles && elements.obstacles.length > 0) || (journeyConnections && journeyConnections.length > 0)) && (
      <div className="form-group">
        <label className="form-label">Validation Status</label>
        {(() => {
          const errors = validateElements();
          if (errors.length === 0) {
            return (
              <div className="status-card status-card-success">
                <div className="status-card-title">✅ All elements valid</div>
              </div>
            );
          } else {
            return (
              <div className="status-card status-card-error">
                <div className="status-card-title">⚠️ Issues found:</div>
                {errors.map((error, index) => (
                  <div key={index} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{error}</div>
                ))}
              </div>
            );
          }
        })()}
      </div>
    )}

    {error && (
      <div className="status-card status-card-error">
        <div className="status-card-title">Error</div>
        <div style={{ fontSize: '0.875rem' }}>{error}</div>
      </div>
    )}
  </div>
</div>

      {/* Files Panel */}
      <div className={`parameters-panel ${showFilesPanel ? 'open' : ''}`}>
        <div className="parameters-panel-header">
          <h2 className="parameters-panel-title">File Management</h2>
        </div>
        <div className="parameters-panel-content">
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Scenario Management</h3>
            <div className="sidebar-button-column">
              <button 
                onClick={() => setShowScenarioGallery(true)}
                className="sidebar-btn"
                disabled={isSimulationMode}
              >
                Browse Scenarios
              </button>
              <button 
                onClick={() => setShowScenarioSave(true)}
                className="sidebar-btn"
                disabled={!canSaveScenario || isSimulationMode}
                title={!canSaveScenario ? "Draw boundaries and configure distributions first" : ""}
              >
                {'Save Scenario'}
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-section-title">File Operations</h3>
            <div className="sidebar-button-column">
              <input
                ref={projectFileInputRef}
                type="file"
                multiple
                accept=".json,.wkt,.txt,.dxf,application/json,text/plain"
                onChange={handleProjectUpload}
                style={{ display: 'none' }}
              />
              <button 
                onClick={() => handleProjectUploadClick(projectFileInputRef)}
                className="sidebar-btn"
                disabled={isSimulationMode}
              >
                Upload Project
              </button>
              <button
                onClick={() => handleProjectDownload(waypointRouting)} 
                className="sidebar-btn"
                disabled={isSimulationMode || elements.boundaries.length === 0}
                title={elements.boundaries.length === 0 ? "Draw a boundary first" : "Download project files"}
              >
                Download Project
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Journey Panel - find this section and replace the content */}
<div className={`parameters-panel-routing ${showJourneyPanel ? 'open' : ''}`}>
  <div className="parameters-panel-header">
    <h2 className="parameters-panel-title">Journey Configuration</h2>
  </div>
  <div className="parameters-panel-content">
    {/* Add the shortest path button here */}
    <div className="sidebar-section">
  <h3 className="sidebar-section-title">Path Optimization</h3>
  <div className="form-group">
    <label className="form-label">
      <input
        type="checkbox"
        checked={useShortestPaths}
        onChange={(e) => handleShortestPathToggle(e.target.checked)}
        style={{ marginRight: '8px' }}
        disabled={elements.boundaries.length === 0 }
      />
      Use Shortest Paths
    </label>
    <p style={{ 
      fontSize: '0.875rem', 
      color: 'var(--color-text-secondary)', 
      marginTop: 'var(--space-sm)',
      fontStyle: 'italic'
    }}>
      {useShortestPaths 
        ? "Journey connections follow shortest paths around obstacles" 
        : "Journey connections are drawn as direct arrows"
      }
    </p>
  </div>
</div>

    <div className="journey-panel" key={`journey-panel-${journeyConnections.length}`}>
      <JourneyAssignmentTool 
        journeyConnections={journeyConnections}
        onJourneyConnectionsChange={handleJourneyConnectionsChange}
        elements={elements}
        selectedJourneyId={selectedJourneyId}
        onSelectedJourneyChange={setSelectedJourneyId}
      />
      <JourneyEditor
        elements={elements}
        journeyConnections={journeyConnections}
        onJourneyConnectionsChange={handleJourneyConnectionsChange}
        waypointRouting={waypointRouting}
        onWaypointRoutingChange={handleWaypointRoutingChange}
        selectedWaypoint={selectedWaypoint}
        onSelectedWaypointChange={setSelectedWaypoint} 
      />
    </div>
  </div>
</div>
      {}
      <div>
        
        <DrawingCanvas
          drawingMode={drawingMode}
          onBoundaryComplete={handleBoundaryComplete}
          onElementsChange={handleElementsChange}
          onJourneyConnectionsChange={handleJourneyConnectionsChange}
          onDistributionClick={handleDistributionClick}
          elements={elements}
          journeyConnections={journeyConnections}
          triggerAutoFit={triggerAutoFit}
          setTriggerAutoFit={setTriggerAutoFit}
          trajectoryData={trajectoryData}
          simulationResults={results}
          isSimulationMode={isSimulationMode}
          onSimulationClose={handleSimulationClose}
          agentRadiusData={results?.agent_radii || {}}
          agentColorData={results?.agent_colors || {}}
          isFileUpload={isFileUpload}
          setIsFileUpload={setIsFileUpload}

          // onLoadMoreFrames={handleLoadMoreFrames}
          trajectoryInfo={chunkedTrajectoryData}

          onUndo={handleUndo}        
          onRedo={handleRedo}  

          elementVisibility={elementVisibility}
          highlightedElement={highlightedElement}
          onHighlightedElementChange={setHighlightedElement}
          individualElementVisibility={individualElementVisibility}

          agentCounts={calculateAgentCounts()}
          hoveredWaypoint={hoveredWaypoint}
          setHoveredWaypoint={setHoveredWaypoint}
          hoveredExit={hoveredExit}
          setHoveredExit={setHoveredExit}
          setWaypointTooltipPosition={setWaypointTooltipPosition}
          setExitTooltipPosition={setExitTooltipPosition}

          waypointRouting={waypointRouting}
          onWaypointRoutingChange={handleWaypointRoutingChange}

          saveToHistory={saveToHistory}
          updateElementsWithHistory={updateElementsWithHistory}
          updateJourneyConnectionsWithHistory={updateJourneyConnectionsWithHistory}
          validateElements={validateElements}
          dragState={dragState}
          setDragState={setDragState}

          useShortestPaths={useShortestPaths}
          computeShortestPaths={computeShortestPaths}

          onWaypointClick={handleWaypointClick}
          onSelectedJourneyChange={setSelectedJourneyId}

          distributionSets={distributionSets}
          getDistributionSet={getDistributionSet}
          getDistributionsInSet={getDistributionsInSet}
          setDistributionSets={setDistributionSets}

          editingWaypoint={editingWaypoint}
          setEditingWaypoint={setEditingWaypoint}
          isDraggingRadius={isDraggingRadius}
          setIsDraggingRadius={setIsDraggingRadius}

          colorByExit={colorByExit}
          setColorByExit={setColorByExit}
          colorByDistribution={colorByDistribution}
          setColorByDistribution={setColorByDistribution}
          agentDistributionColors={agentDistributionColors}
          agentExitColors={agentExitColors}

          showAgentTrails={showAgentTrails}
          setShowAgentTrails={setShowAgentTrails}

          showDensityHeatmap={showDensityHeatmap}
          setShowDensityHeatmap={setShowDensityHeatmap}
          heatmapData={heatmapData}

          computeHeatmap={computeHeatmap}
        />

      </div>
      
      {/* Simplified Set Manager Modal - just for creating new sets */}
{showSetManager && (
  <div className="modal-overlay">
    <div className="modal">
      <h3 className="modal-title">Create New Distribution Set</h3>
      
      <div className="form-group">
        <label className="form-label">Set Name:</label>
        <input
          type="text"
          placeholder="Enter set name"
          className="form-input"
          autoFocus
          onKeyPress={(e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              const setName = e.target.value.trim();
              const setId = `set_${Date.now()}`;
              setDistributionSets(prev => ({
                ...prev,
                [setId]: {
                  name: setName,
                  distributionIds: []
                }
              }));
              setSelectedSet(setId); // Auto-select the new set for management
              setShowSetManager(false);
            }
          }}
        />
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: 'var(--space-sm)',
          fontStyle: 'italic'
        }}>
          Press Enter to create the set
        </p>
      </div>

      <div className="modal-actions">
        <button
          onClick={() => setShowSetManager(false)}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      {}
      {showDistributionEditor && selectedDistribution && (
  <div className="modal-overlay">
    <div className="modal">
      <h3 className="modal-title">Configure Starting Area</h3>
      
      <div className="form-group">
        <label className="form-label">Number of Agents:</label>
        <input
          type="text"
          value={selectedDistribution.parameters?.number || ''}
          onChange={(e) => {
            const inputValue = e.target.value;
            
            if (inputValue === '' || /^\d+$/.test(inputValue)) {
              const newNumber = inputValue === '' ? '' : parseInt(inputValue);
              
              updateDistributionParameters(selectedDistribution.id, { number: newNumber });
              setSelectedDistribution(prev => ({
                ...prev,
                parameters: { ...prev.parameters, number: newNumber }
              }));
            }
          }}
          className="form-input"
          placeholder="Number of agents"
        />
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: 'var(--space-sm)' 
        }}>
          Number of pedestrians to spawn in this starting area
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Agent Radius (m):</label>
        <input
          type="number"
          min="0.1"
          max="1.0"
          step="0.1"
          value={selectedDistribution.parameters?.radius || 0.3}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            const newRadius = Math.min(1, Math.max(0.1, isNaN(value) ? 0.1 : value));
            updateDistributionParameters(selectedDistribution.id, { radius: newRadius });
            setSelectedDistribution(prev => ({
              ...prev,
              parameters: { ...prev.parameters, radius: newRadius }
            }));
          }}
          className="form-input"
        />
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: 'var(--space-sm)' 
        }}>
          Physical radius of each agent (range 0.1-1.0 m)
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Desired Speed (m/s):</label>
        <input
          type="number"
          min="0.5"
          max="2.0"
          step="0.1"
          value={selectedDistribution.parameters?.v0 || 1.3}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            const newV0 = Math.min(2.0, Math.max(0.5, isNaN(value) ? 0.5 : value));

            updateDistributionParameters(selectedDistribution.id, { v0: newV0 });
            setSelectedDistribution(prev => ({
              ...prev,
              parameters: { ...prev.parameters, v0: newV0 }
            }));
          }}
          className="form-input"
        />
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: 'var(--space-sm)' 
        }}>
          Preferred walking speed (range: 0.5-2.0 m/s)
        </p>
      </div>

      {/* NEW: Time-based Spawning Section */}
<div className="parameter-group" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--color-border)' }}>
  <div className="form-group">
    <label className="form-label">
      <input
        type="checkbox"
        checked={selectedDistribution.parameters?.use_flow_spawning || false}
        onChange={(e) => {
          const useFlowSpawning = e.target.checked;
          const currentParams = selectedDistribution.parameters || {};
          
          const newParams = {
            use_flow_spawning: useFlowSpawning,
            flow_start_time: useFlowSpawning ? (currentParams.flow_start_time || 0) : 0,
            flow_end_time: useFlowSpawning ? (currentParams.flow_end_time || 10) : 0,
          };
          
          updateDistributionParameters(selectedDistribution.id, newParams);
          setSelectedDistribution(prev => ({
            ...prev,
            parameters: { ...(prev.parameters || {}), ...newParams }
          }));
        }}
        style={{ marginRight: '8px' }}
      />
      Enable Flow Spawning
    </label>
    <p style={{ 
      fontSize: '0.875rem', 
      color: 'var(--color-text-secondary)', 
      marginTop: 'var(--space-sm)',
      fontStyle: 'italic'
    }}>
      Spawn agents continuously over time instead of all at once
    </p>
  </div>

  {(selectedDistribution.parameters?.use_flow_spawning) && (
    <>
      <div className="form-group">
        <label className="form-label">Start Time (s):</label>
        <input
          type="number"
          min="0"
          max="300"
          step="0.1"
          value={selectedDistribution.parameters?.flow_start_time || 0}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            const newStartTime = Math.max(0, isNaN(value) ? 0 : value);
            
            updateDistributionParameters(selectedDistribution.id, { flow_start_time: newStartTime });
            setSelectedDistribution(prev => ({
              ...prev,
              parameters: { ...(prev.parameters || {}), flow_start_time: newStartTime }
            }));
          }}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label">End Time (s):</label>
        <input
          type="number"
          min="0.1"
          max="300"
          step="0.1"
          value={selectedDistribution.parameters?.flow_end_time || 10}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            const startTime = selectedDistribution.parameters?.flow_start_time || 0;
            const newEndTime = Math.max(startTime + 0.1, isNaN(value) ? startTime + 0.1 : value);
            
            updateDistributionParameters(selectedDistribution.id, { flow_end_time: newEndTime });
            setSelectedDistribution(prev => ({
              ...prev,
              parameters: { ...(prev.parameters || {}), flow_end_time: newEndTime }
            }));
          }}
          className="form-input"
        />
      </div>

      {/* Show calculated frequency */}
      <div className="form-group">
        <div style={{ 
          padding: '10px', 
          backgroundColor: 'var(--color-bg-secondary)', 
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          <strong>Calculated Flow Rate:</strong><br/>
          {(() => {
            const n = selectedDistribution.parameters?.number || 0;
            const startTime = selectedDistribution.parameters?.flow_start_time || 0;
            const endTime = selectedDistribution.parameters?.flow_end_time || 10;
            const duration = endTime - startTime;
            const frequency = duration > 0 ? (n / duration).toFixed(2) : 0;
            return `${frequency} agents/second over ${duration}s duration`;
          })()}
        </div>
      </div>
    </>
  )}
</div>

      <div className="modal-actions">
        <button
          onClick={() => {
            setShowDistributionEditor(false);
            setSelectedDistribution(null);
          }}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setShowDistributionEditor(false);
            setSelectedDistribution(null);
          }}
          className="btn btn-primary"
        >
          Save Configuration
        </button>
      </div>
    </div>
  </div>
)}

      {showWaypointEditor && selectedWaypoint && (
  <div className="modal-overlay">
    <div className="modal">
      <h3 className="modal-title">Configure Waypoint</h3>
      
      <div className="form-group">
        <label className="form-label">Radius (pixels):</label>
        <input
          type="number"
          min="0.1"
          max="10.0"
          step="0.1"
          value={selectedWaypoint.radius || 23.0}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            const newRadius = Math.min(10.0, Math.max(0.1, isNaN(value) ? 0.1 : value));
            updateWaypointParameters(selectedWaypoint.id, { radius: newRadius });
            setSelectedWaypoint(prev => ({
              ...prev,
              radius: newRadius
            }));
          }}
          className="form-input"
        />
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginTop: 'var(--space-sm)' 
        }}>
          Waypoint radius in Pixels 
        </p>
      </div>

      <div className="modal-actions">
        <button
          onClick={() => {
            setShowWaypointEditor(false);
            setSelectedWaypoint(null);
          }}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setShowWaypointEditor(false);
            setSelectedWaypoint(null);
          }}
          className="btn btn-primary"
        >
          Save Configuration
        </button>
      </div>
    </div>
  </div>
)}
      {hoveredWaypoint && !isSimulationMode && (
  <div 
    className="distribution-tooltip"
    style={{
      position: 'absolute',
      left: waypointTooltipPosition.x + 15,
      top: waypointTooltipPosition.y - 10,
      zIndex: 1000,
      pointerEvents: 'none' 
    }}
  >
    <div className="distribution-tooltip-content">
      <div className="distribution-tooltip-title">
        Waypoint
      </div>
      <div className="distribution-tooltip-params">
        <div className="param-row">
          <span className="param-label">Agents passing:</span>
          <span className="param-value">{calculateAgentCounts().waypoints[hoveredWaypoint.id] || 0}</span>
        </div>
      </div>
    </div>
  </div>
)}

{hoveredExit && !isSimulationMode && (
  <div 
    className="distribution-tooltip"
    style={{
      position: 'absolute',
      left: exitTooltipPosition.x + 15,
      top: exitTooltipPosition.y - 10,
      zIndex: 1000,
      pointerEvents: 'none' 
    }}
  >
    <div className="distribution-tooltip-content">
      <div className="distribution-tooltip-title">
        Exit
      </div>
      <div className="distribution-tooltip-params">
        <div className="param-row">
          <span className="param-label">Agents evacuating:</span>
          <span className="param-value">{calculateAgentCounts().exits[hoveredExit.id] || 0}</span>
        </div>
      </div>
    </div>
  </div>
)}
      {/* Scenario Management Modals */}
<ScenarioGallery
  isOpen={showScenarioGallery}
  onClose={() => setShowScenarioGallery(false)}
  onLoadScenario={handleLoadScenario}
/>


<ScenarioSaveModal
  isOpen={showScenarioSave}
  onClose={() => setShowScenarioSave(false)}
  currentScenario={ null}
  elements={elements}
  journeyConnections={journeyConnections}
  generateConfigFromDrawing={generateConfigForSave}
  waypointRouting={waypointRouting}
/>

<Chatbot
  isOpen={showChatbot}
  onToggle={() => setShowChatbot(prev => !prev)}
  onGeometryGenerated={handleChatbotGeometry}
/>
    </div>
  );
}