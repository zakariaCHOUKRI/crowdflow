import jupedsim as jps
from shapely import wkt
from models import JourneyPathRequest, JourneyPathResponse

async def compute_shortest_paths(request: JourneyPathRequest) -> JourneyPathResponse:
    """Compute shortest paths for journey connections using JupedSim routing engine"""
    try:
        # Parse walkable area geometry
        geometry = wkt.loads(request.walkable_area_wkt)
        
        # Create routing engine
        routing_engine = jps.RoutingEngine(geometry)
        
        # Process connections (your existing logic)
        enhanced_connections = []
        errors = []
        
        # ... rest of your computation logic
        
        return JourneyPathResponse(
            journey_connections=enhanced_connections,
            success=len(errors) == 0,
            errors=errors
        )
        
    except Exception as e:
        return JourneyPathResponse(
            journey_connections=request.journey_connections,
            success=False,
            errors=[f"Failed to compute journey paths: {str(e)}"]
        )

def getElementCenter(element):
    """Helper function to get element center"""
    if 'center' in element:  # waypoint
        return element['center']
    elif 'points' in element and len(element['points']) > 0:  # polygon elements
        points = element['points']
        center_x = sum(p['x'] for p in points) / len(points)
        center_y = sum(p['y'] for p in points) / len(points)
        return {'x': center_x, 'y': center_y}
    return None
