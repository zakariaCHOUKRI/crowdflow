from fastapi import APIRouter
from models import JourneyPathRequest, JourneyPathResponse
from services.journey_service import compute_shortest_paths, getElementCenter
from shapely import wkt
import jupedsim as jps

router = APIRouter()

@router.post("/compute_journey_paths", response_model=JourneyPathResponse)
async def compute_journey_paths(request: JourneyPathRequest):
    """Compute shortest paths for journey connections using JupedSim routing engine"""
    try:
        print(f"Received WKT: {request.walkable_area_wkt}")  # DEBUG
        
        # Parse walkable area geometry
        geometry = wkt.loads(request.walkable_area_wkt)
        print(f"Geometry is valid: {geometry.is_valid}, is simple: {geometry.is_simple}")  # DEBUG
        
        if not geometry.is_valid or not geometry.is_simple:
            # Try to fix the geometry
            geometry = geometry.buffer(0)
            if not geometry.is_valid or not geometry.is_simple:
                return JourneyPathResponse(
                    journey_connections=request.journey_connections,
                    success=False,
                    errors=["Invalid walkable area geometry. Please redraw the boundary."]
                )
        
        # Create routing engine
        routing_engine = jps.RoutingEngine(geometry)
        
        # Process each journey connection
        enhanced_connections = []
        errors = []
        
        for connection in request.journey_connections:
            try:
                # Get from and to IDs
                from_id = connection.get('fromId') or (connection.get('from', {}).get('element', {}).get('id'))
                to_id = connection.get('toId') or (connection.get('to', {}).get('element', {}).get('id'))
                
                if not from_id or not to_id:
                    errors.append(f"Invalid connection format: {connection}")
                    enhanced_connections.append(connection)
                    continue
                
                print(f"Looking for elements: from={from_id}, to={to_id}")  # DEBUG
                
                # Find elements by ID in the transformed elements
                from_element = None
                to_element = None
                
                # Search in all element types (these are already transformed coordinates)
                all_elements = []
                if 'distributions' in request.elements:
                    all_elements.extend(request.elements['distributions'])
                if 'waypoints' in request.elements:
                    all_elements.extend(request.elements['waypoints'])
                if 'exits' in request.elements:
                    all_elements.extend(request.elements['exits'])
                
                for element in all_elements:
                    if element.get('id') == from_id:
                        from_element = element
                    if element.get('id') == to_id:
                        to_element = element
                
                if not from_element or not to_element:
                    errors.append(f"Could not find elements for connection from {from_id} to {to_id}")
                    enhanced_connections.append(connection)
                    continue
                
                # Get centers (these are already in simulation coordinates)
                from_center = getElementCenter(from_element)
                to_center = getElementCenter(to_element)
                
                if not from_center or not to_center:
                    errors.append(f"Could not compute centers for connection from {from_id} to {to_id}")
                    enhanced_connections.append(connection)
                    continue
                
                print(f"Computing path from {from_center} to {to_center}")  # DEBUG
                
                # Compute shortest path
                waypoints = routing_engine.compute_waypoints(
                    (from_center['x'], from_center['y']),
                    (to_center['x'], to_center['y'])
                )
                
                print(f"Computed waypoints: {waypoints}")  # DEBUG
                
                # Create enhanced connection
                enhanced_connection = connection.copy()
                enhanced_connection['routingMode'] = 'shortest-path'
                enhanced_connection['waypoints'] = waypoints
                enhanced_connections.append(enhanced_connection)
                
            except Exception as e:
                print(f"Error processing connection: {e}")  # DEBUG
                import traceback
                traceback.print_exc()
                errors.append(f"Error computing path: {str(e)}")
                enhanced_connections.append(connection)
        
        return JourneyPathResponse(
            journey_connections=enhanced_connections,
            success=len(errors) == 0,
            errors=errors
        )
        
    except Exception as e:
        print(f"Overall error: {e}")  # DEBUG
        import traceback
        traceback.print_exc()
        return JourneyPathResponse(
            journey_connections=request.journey_connections,
            success=False,
            errors=[f"Failed to compute journey paths: {str(e)}"]
        )
