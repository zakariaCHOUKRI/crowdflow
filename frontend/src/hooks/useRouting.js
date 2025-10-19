// Add this function to handle the API call
export const computeJourneyPaths = async (walkableAreaWkt, journeyConnections, elements) => {
  try {
    const response = await fetch('/compute_journey_paths', {
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