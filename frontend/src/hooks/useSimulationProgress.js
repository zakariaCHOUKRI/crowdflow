import { useState, useEffect, useCallback, useRef } from 'react';

export const useSimulationProgress = () => {
  const [progress, setProgress] = useState({
    stage: null,
    progress: 0,
    message: '',
    isLoading: false,
    error: null,
    results: null,
    simulationId: null // Add this to track simulation ID
  });
  
  const eventSourceRef = useRef(null);
  const currentSimulationId = useRef(null);
  const reconnectAttempts = useRef(0);
  const isCompletedRef = useRef(false);
  const maxReconnectAttempts = 3;

  const fetchResults = useCallback(async (simulationId) => {
    try {
      
      setProgress(prev => ({
        ...prev,
        message: 'Fetching simulation results...'
      }));
      
      const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
      const response = await fetch(`${fetchURL}/simulation_results/${simulationId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();

      setProgress(prev => ({
        ...prev,
        results: results,
        isLoading: false,
        stage: 'completed',
        progress: 100,
        message: 'Simulation completed successfully!',
        simulationId: simulationId // Store the simulation ID
      }));

      isCompletedRef.current = true;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
    } catch (error) {
      console.error('Error fetching results:', error);
      setProgress(prev => ({
        ...prev,
        error: error.message || 'Failed to fetch results',
        isLoading: false
      }));
    }
  }, []);

  
  const connectToEventStream = useCallback((simulationId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setProgress(prev => ({
      ...prev,
      message: 'Connecting to simulation stream...'
    }));
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    eventSourceRef.current = new EventSource(`${fetchURL}/simulation_stream/${simulationId}`);

    eventSourceRef.current.onopen = () => {
      reconnectAttempts.current = 0;
    };

    eventSourceRef.current.onmessage = (event) => {
      try {
        const progressData = JSON.parse(event.data);
        
        if (progressData.error) {
          setProgress(prev => ({
            ...prev,
            error: progressData.error,
            isLoading: false
          }));
          return;
        }

        if (progressData.stage === 'connected') {
          setProgress(prev => ({
            ...prev,
            message: 'Connected to simulation stream'
          }));
          return;
        }

        setProgress(prev => ({
          ...prev,
          stage: progressData.stage,
          progress: progressData.progress || 0,
          message: progressData.message || '',
          error: null
        }));

        if (progressData.stage === 'completed') {
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          fetchResults(simulationId);
        } else if (progressData.stage === 'failed') {
          setProgress(prev => ({
            ...prev,
            isLoading: false,
            error: progressData.message || 'Simulation failed'
          }));
          
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      } catch (err) {
        console.error('Error parsing progress data:', err);
      }
    };

    eventSourceRef.current.onerror = (error) => {
      console.error('EventSource failed:', error);
      
      if (!isCompletedRef.current) {
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setProgress(prev => ({
            ...prev,
            message: `Reconnecting... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          }));
          
          setTimeout(() => {
            if (currentSimulationId.current && !isCompletedRef.current) {
              connectToEventStream(currentSimulationId.current);
            }
          }, 2000);
        } else {
          setProgress(prev => ({
            ...prev,
            error: 'Connection lost. Please check if simulation completed in results.',
            isLoading: false
          }));
        }
      }
      
      eventSourceRef.current?.close();
    };
  }, [fetchResults]);

  const startSimulation = useCallback(async (simulationConfig, walkableAreaWkt, parameters, waypointRouting = {}) => {
  try {
    isCompletedRef.current = false;
    
    setProgress({
      stage: 'starting',
      progress: 0,
      message: 'Starting simulation...',
      isLoading: true,
      error: null,
      results: null,
      simulationId: null
    });

    reconnectAttempts.current = 0;
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    
 
    
    const response = await fetch(`${fetchURL}/simulate_with_visualization_start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulation_config: simulationConfig,
          walkable_area_wkt: walkableAreaWkt,
          parameters: parameters,
          waypoint_routing: waypointRouting
        })
      });

if (!response.ok) {
  // Add this debugging to see the actual error
  const errorText = await response.text();
  console.error('❌ Backend error response:', errorText);
  
  try {
    const errorJson = JSON.parse(errorText);
    console.error('❌ Parsed error:', errorJson);
    throw new Error(`HTTP ${response.status}: ${errorJson.detail || errorText}`);
  } catch (parseError) {
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
}

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const simulationId = data.simulation_id;
    currentSimulationId.current = simulationId;

    connectToEventStream(simulationId);

  } catch (error) {
    console.error('Error starting simulation:', error);
    setProgress(prev => ({
      ...prev,
      error: error.message || 'Failed to start simulation',
      isLoading: false
    }));
  }
}, [connectToEventStream]);

  const cancelSimulation = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setProgress({
      stage: null,
      progress: 0,
      message: '',
      isLoading: false,
      error: null,
      results: null,
      simulationId: null
    });
    
    currentSimulationId.current = null;
    reconnectAttempts.current = 0;
    isCompletedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    progress,
    startSimulation,
    cancelSimulation,
    isLoading: progress.isLoading,
    error: progress.error,
    results: progress.results,
    simulationId: progress.simulationId
  };
};