import { useState, useCallback, useRef, useEffect } from 'react';

export const useLiveSimulation = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [simulationId, setSimulationId] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [message, setMessage] = useState('');
  const [frameData, setFrameData] = useState(null);
  const [simulationInfo, setSimulationInfo] = useState(null);
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const frameCountRef = useRef(0);

  
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          setIsConnected(true);
          setError(null);
          break;

        case 'status':
          const statusData = message.data;
          setStatus(statusData.status);
          setMessage(statusData.message);
          break;

        case 'simulation_info':
          setSimulationInfo(message.data);
          setTrajectoryData([]); 
          frameCountRef.current = 0;
          break;

        case 'frame':
          const frameData = message.data;
          setFrameData(frameData);
          
          
          setTrajectoryData(prev => {
            const newData = [...prev, frameData];
            frameCountRef.current = newData.length;
            return newData;
          });
          break;

        case 'simulation_complete':
          setStatus('completed');
          setResults(message.data);
          setMessage(message.data.message);
          break;

        case 'simulation_stopped':
          setStatus('stopped');
          setMessage(message.data.message);
          break;

        case 'error':
          setStatus('failed');
          setError(message.data.error);
          setMessage(message.data.message);
          break;

        case 'pong':
          
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  }, []);

  
  const connectWebSocket = useCallback((simId) => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    const wsUrl = `ws://localhost:8001/ws/live_simulation/${simId}`;

    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    websocketRef.current.onmessage = handleWebSocketMessage;

    websocketRef.current.onclose = (event) => {
      setIsConnected(false);
      
      
      if (event.code !== 1000 && status === 'running') {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(simId);
        }, 3000);
      }
    };

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
    };
  }, [handleWebSocketMessage, status]);

  
  const startLiveSimulation = useCallback(async (simulationConfig, walkableAreaWkt, parameters) => {
    try {
      setError(null);
      setStatus('initializing');
      setMessage('Starting simulation...');

      const fetchURL = process.env.REACT_APP_BACKEND_LIVE_API || 'http://localhost:8001';
      const response = await fetch(`${fetchURL}/live_simulation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulation_config: simulationConfig,
          walkable_area_wkt: walkableAreaWkt,
          parameters: {
            max_simulation_time: parameters.max_simulation_time,
            model_type: parameters.model_type,
            
            strength_neighbor_repulsion: parameters.strength_neighbor_repulsion,
            range_neighbor_repulsion: parameters.range_neighbor_repulsion,
            mass: parameters.mass,
            tau: parameters.tau,
            relaxation_time: parameters.relaxation_time,
            agent_strength: parameters.agent_strength,
            agent_range: parameters.agent_range,
            T: parameters.T,
            s0: parameters.s0
          },
          fps: 10 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start simulation');
      }

      const data = await response.json();
      const simId = data.simulation_id;
      
      setSimulationId(simId);
      connectWebSocket(simId);

      return simId;
    } catch (err) {
      setError(err.message);
      setStatus('failed');
      throw err;
    }
  }, [connectWebSocket]);

  
  const stopSimulation = useCallback(async () => {
    if (!simulationId) return;

    try {
      const fetchURL = process.env.REACT_APP_BACKEND_LIVE_API || 'http://localhost:8001';
      await fetch(`${fetchURL}/live_simulation/${simulationId}/stop`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Error stopping simulation:', err);
    }
  }, [simulationId]);

  
  const sendMessage = useCallback((message) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    }
  }, []);

  
  const stopSimulationWS = useCallback(() => {
    sendMessage({ type: 'stop_simulation' });
  }, [sendMessage]);

  
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close(1000, 'Component unmounting');
    }
    setIsConnected(false);
    setSimulationId(null);
    setStatus('idle');
    setFrameData(null);
    setTrajectoryData([]);
    setResults(null);
    setError(null);
  }, []);

  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    
    isConnected,
    simulationId,
    status,
    message,
    frameData,
    simulationInfo,
    trajectoryData,
    results,
    error,
    
    
    startLiveSimulation,
    stopSimulation,
    stopSimulationWS,
    cleanup,
    
    
    isRunning: status === 'running',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    currentFrame: frameCountRef.current - 1
  };
};