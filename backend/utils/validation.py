from typing import Any, Dict

from fastapi import HTTPException


def validate_and_process_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and process the simulation config to ensure exits are present"""
    import copy
    processed_config = copy.deepcopy(config)
        
    # ONLY require exits now
    if "exits" not in processed_config or not processed_config["exits"]:
        raise ValueError("At least one exit is required for simulation")
    
    # Validate exits
    for exit_id, exit_data in processed_config["exits"].items():
        if "coordinates" not in exit_data:
            raise ValueError(f"Exit {exit_id} is missing coordinates")
        
        coords = exit_data["coordinates"]
        if not isinstance(coords, list) or len(coords) < 3:
            raise ValueError(f"Exit {exit_id} must have at least 3 coordinate points")
    
    # Distributions are optional now - will use fallback if missing
    if "distributions" in processed_config and isinstance(processed_config["distributions"], dict):
        for dist_id, distribution in processed_config["distributions"].items():
            if not isinstance(distribution, dict):
                raise ValueError(f"Distribution {dist_id} must be a dictionary")
            
            if "parameters" in distribution:
                params = distribution["parameters"]
                if isinstance(params, dict) and "number" in params:
                    agent_count = params["number"]
                    if not isinstance(agent_count, (int, float)) or agent_count <= 0:
                        raise ValueError(f"Distribution {dist_id} has invalid agent count: {agent_count}")
    
    # Ensure other sections exist (can be empty)
    if "waypoints" not in processed_config:
        processed_config["waypoints"] = {}
    if "journeys" not in processed_config:
        processed_config["journeys"] = []
    if "transitions" not in processed_config:
        processed_config["transitions"] = []
    
    return processed_config
def calculate_total_agents(config: Dict[str, Any]) -> int:
    """Calculate total number of agents from all distributions"""
    total_agents = 0
    
    if "distributions" in config and isinstance(config["distributions"], dict):
        for dist_id, distribution in config["distributions"].items():
            if isinstance(distribution, dict) and "parameters" in distribution:
                agent_count = distribution["parameters"].get("number", 0)
                total_agents += int(agent_count)
    
    return total_agents

def _validate_waypoint_routing(waypoint_routing: Dict, simulation_config: Dict):
    """Validate waypoint routing percentages and references"""
    
    waypoints = simulation_config.get("waypoints", {})
    exits = simulation_config.get("exits", {})
    journeys = simulation_config.get("journeys", [])
    
    if not journeys:
        return  # No journeys to validate
    
    journey_ids = {j["id"] for j in journeys}
    valid_targets = set(waypoints.keys()) | set(exits.keys())
    
    for waypoint_id, journey_routing in waypoint_routing.items():
        if waypoint_id not in waypoints:
            raise HTTPException(400, f"Waypoint {waypoint_id} not found in configuration")
        
        for journey_id, routing_config in journey_routing.items():
            if journey_id not in journey_ids:
                raise HTTPException(400, f"Journey {journey_id} not found")
            
            destinations = routing_config.destinations if hasattr(routing_config, 'destinations') else routing_config.get("destinations", [])
            
            if not destinations:
                continue
                
            total_percentage = sum(dest.percentage if hasattr(dest, 'percentage') else dest["percentage"] for dest in destinations)
            
            if abs(total_percentage - 100) > 0.1:  # Allow small floating point errors
                raise HTTPException(400, 
                    f"Percentages for waypoint {waypoint_id} in journey {journey_id} "
                    f"must sum to 100%, got {total_percentage}%")
            
            for dest in destinations:
                target = dest.target if hasattr(dest, 'target') else dest["target"]
                if target not in valid_targets:
                    raise HTTPException(400, 
                        f"Invalid target {target} in waypoint routing")
