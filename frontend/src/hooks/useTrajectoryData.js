import { useState, useEffect, useCallback, useRef } from 'react';

export const useTrajectoryData = (simulationId) => {
  const [trajectoryData, setTrajectoryData] = useState({
    frames: [],
    totalFrames: 0,
    loadedFrames: 0,
    isLoading: false,
    error: null,
    hasMore: false,
    nextStartFrame: null
  });

  const isLoadingRef = useRef(false);
  const trajectoryDataRef = useRef(trajectoryData); // ADD THIS

  // Update ref whenever state changes
  useEffect(() => {
    trajectoryDataRef.current = trajectoryData;
  }, [trajectoryData]);

  const loadTrajectoryChunk = useCallback(async (simulationId, startFrame = 0, chunkSize = 50) => {
  if (!simulationId || isLoadingRef.current) return null;

  isLoadingRef.current = true;
  setTrajectoryData(prev => ({ ...prev, isLoading: true, error: null }));

  try {
    const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
    const response = await fetch(
      `${fetchURL}/simulation_trajectory/${simulationId}?start_frame=${startFrame}&chunk_size=${chunkSize}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const chunkData = await response.json();

    setTrajectoryData(prev => ({
      ...prev,
      frames: startFrame === 0 ? chunkData.frames : [...prev.frames, ...chunkData.frames],
      totalFrames: chunkData.total_frames,
      loadedFrames: prev.loadedFrames + chunkData.frames.length,
      isLoading: false,
      hasMore: chunkData.has_more,
      nextStartFrame: chunkData.next_start_frame
    }));

    return chunkData;

  } catch (error) {
    console.error('Error loading trajectory chunk:', error);
    setTrajectoryData(prev => ({
      ...prev,
      error: error.message,
      isLoading: false
    }));
    throw error;
  } finally {
    isLoadingRef.current = false;
  }
}, []);

  const loadMoreFrames = useCallback(async (simulationId, chunkSize = 50) => {
    if (!trajectoryData.hasMore || trajectoryData.isLoading) return;
    
    return await loadTrajectoryChunk(simulationId, trajectoryData.nextStartFrame, chunkSize);
  }, [trajectoryData.hasMore, trajectoryData.isLoading, trajectoryData.nextStartFrame, loadTrajectoryChunk]);

  const resetTrajectoryData = useCallback(() => {
    setTrajectoryData({
      frames: [],
      totalFrames: 0,
      loadedFrames: 0,
      isLoading: false,
      error: null,
      hasMore: false,
      nextStartFrame: null
    });
    isLoadingRef.current = false;
  }, []);

  const loadAllTrajectory = useCallback(async (chunkSize = 100) => {
  if (!simulationId) return;

  
  let startFrame = 50; // Start from frame 50 since we already loaded 0-49
  let hasMore = true;
  
  while (hasMore) {
    try {
      
      const chunk = await loadTrajectoryChunk(simulationId, startFrame, chunkSize);
      
      if (!chunk) break;
      
      hasMore = chunk.has_more;
      startFrame = chunk.next_start_frame || (startFrame + chunkSize);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error('Error loading trajectory:', error);
      break;
    }
  }
  
}, [simulationId, loadTrajectoryChunk]);


  return {
    trajectoryData,
    loadTrajectoryChunk,
    loadMoreFrames,
    loadAllTrajectory,
    resetTrajectoryData
  };
};