import json
import pedpy
from shapely.geometry import Polygon
import matplotlib.pyplot as plt
from typing import Any, Dict, List, Tuple
import jupedsim as jps
import shapely
from collections import defaultdict
import numpy as np

import importlib.util
import subprocess
import sys

required_packages = [
    ("jupedsim", "jupedsim"),
    ("shapely", "shapely"),
    ("numpy", "numpy"),
    ("matplotlib", "matplotlib"),
    ("pedpy", "pedpy"),
    ("ezdxf", "ezdxf"),
    ("plotly", "plotly"),
    ("geopandas", "geopandas"),
    ("typer", "typer"),
    ("nbformat", "nbformat"),
]


def is_package_installed(import_name: str) -> bool:
    """Check if packages is installed."""
    return importlib.util.find_spec(import_name) is not None


def install_if_missing(pip_name: str, import_name: str = None):
    """Pip install missing packages."""
    import_name = import_name or pip_name
    if not is_package_installed(import_name):
        print(f"Installing {pip_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pip_name])
    else:
        print(f"{pip_name} already installed.")


def create_agent_parameters(model_type: str, position: tuple, params: dict, global_params=None, journey_id=None, stage_id=None):
    """Create appropriate agent parameters based on the model type"""
    
    base_params = {
        "position": position,
        "radius": params.get("radius", 0.2),
    }
    
    # Add journey and stage if provided
    if journey_id is not None:
        base_params["journey_id"] = journey_id
    if stage_id is not None:
        base_params["stage_id"] = stage_id
    
    if model_type == "CollisionFreeSpeedModel":
        base_params["v0"] = params.get("v0", 1.2)
        return jps.CollisionFreeSpeedModelAgentParameters(**base_params)
    
    elif model_type == "CollisionFreeSpeedModelV2":
        v2_params = base_params.copy()
        v2_params["desired_speed"] = params.get("v0", 1.2)
        v2_params["time_gap"] = 1.0
        if global_params:
            v2_params["strength_neighbor_repulsion"] = global_params.strength_neighbor_repulsion
            v2_params["range_neighbor_repulsion"] = global_params.range_neighbor_repulsion
        return jps.CollisionFreeSpeedModelV2AgentParameters(**v2_params)
    
    elif model_type == "GeneralizedCentrifugalForceModel":
        gcfm_params = {
            "position": position,
            "desired_speed": params.get("v0", 1.2),
            "mass": global_params.mass if global_params else 80.0,
            "tau": global_params.tau if global_params else 0.5,
        }
        if journey_id is not None:
            gcfm_params["journey_id"] = journey_id
        if stage_id is not None:
            gcfm_params["stage_id"] = stage_id
        return jps.GeneralizedCentrifugalForceModelAgentParameters(**gcfm_params)
    
    elif model_type == "SocialForceModel":
        sfm_params = base_params.copy()
        sfm_params["desired_speed"] = params.get("v0", 0.8)
        sfm_params["reaction_time"] = global_params.relaxation_time if global_params else 0.5
        sfm_params["agent_scale"] = global_params.agent_strength if global_params else 2000
        sfm_params["force_distance"] = global_params.agent_range if global_params else 0.08
        return jps.SocialForceModelAgentParameters(**sfm_params)
    
    elif model_type == "AnticipationVelocityModel":
        avm_params = base_params.copy()
        avm_params["desired_speed"] = params.get("v0", 1.2)
        avm_params["time_gap"] = 1.06  # Default value
        if global_params:
            avm_params["anticipation_time"] = global_params.T if hasattr(global_params, 'T') else 1.0
            avm_params["reaction_time"] = global_params.s0 if hasattr(global_params, 's0') else 0.3
        else:
            avm_params["anticipation_time"] = 1.0
            avm_params["reaction_time"] = 0.3
        return jps.AnticipationVelocityModelAgentParameters(**avm_params)
    
    else:
        # Fallback to CollisionFreeSpeedModel
        base_params["v0"] = params.get("v0", 1.2)
        return jps.CollisionFreeSpeedModelAgentParameters(**base_params)


def initialize_simulation_from_json(
    json_path: str,
    simulation: jps.Simulation,
    walkable_area: pedpy.WalkableArea,
    seed: int = 42,
    model_type: str = "CollisionFreeSpeedModel",
    global_parameters=None,
) -> Tuple[Dict[str, Any], List[Tuple[float, float]], Dict[int, float]]:
    """
    Initialize a JuPedSim simulation from a JSON configuration with fallback logic.
    """
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        raise ValueError(f"Error loading JSON configuration: {e}")

    # Only require exits - everything else can be fallback
    if "exits" not in data or not data["exits"]:
        raise ValueError("At least one exit is required in JSON configuration")

    # Check what's missing and use fallback logic
    needs_fallback = False
    fallback_reasons = []
    
    if "distributions" not in data or not data["distributions"]:
        needs_fallback = True
        fallback_reasons.append("No distributions defined")
        
    if "journeys" not in data or not data["journeys"]:
        needs_fallback = True
        fallback_reasons.append("No journeys defined")
        
    if "waypoints" not in data:
        data["waypoints"] = {}
        
    if "transitions" not in data:
        data["transitions"] = []

    if needs_fallback:
        print(f"Using fallback logic: {', '.join(fallback_reasons)}")
        return _initialize_with_fallback(
            simulation, data, walkable_area, seed, model_type, global_parameters
        )
    else:
        # Use original logic for complete configurations
        return _initialize_complete_config(
            simulation, data, walkable_area, seed, model_type, global_parameters
        )

def _initialize_complete_config(
    simulation: jps.Simulation,
    data: Dict[str, Any],
    walkable_area: pedpy.WalkableArea,
    seed: int,
    model_type: str,
    global_parameters=None,
) -> Tuple[Dict[str, Any], List[Tuple[float, float]], Dict[int, float]]:
    """Original initialization logic for complete configurations"""
    stage_map = _add_stages(simulation, data)
    dist_geom, dist_params = _process_distributions(data)
    journey_data = _create_journeys(simulation, data, stage_map)

    positions, agent_radii = _add_agents(
        simulation=simulation,
        data=data,
        stage_map=stage_map,
        dist_geom=dist_geom,
        dist_params=dist_params,
        journey_data=journey_data,
        walkable_area=walkable_area,
        seed=seed,
        model_type=model_type,
        global_parameters=global_parameters,
    )

    return {
        "stage_map": stage_map,
        "journey_ids": journey_data["journey_ids"],
    }, positions, agent_radii

def _initialize_with_fallback(
    simulation: jps.Simulation,
    data: Dict[str, Any],
    walkable_area: pedpy.WalkableArea,
    seed: int,
    model_type: str,
    global_parameters=None,
) -> Tuple[Dict[str, Any], List[Tuple[float, float]], Dict[int, float]]:
    """Fallback initialization logic"""
    from shapely.geometry import Point, Polygon
    from shapely.ops import unary_union
    import numpy as np

    # print("Data:", data)

    # Extract default parameters from distributions if available
    default_agent_radius = 0.2
    default_v0 = 1.2
    default_n_agents = 100

    # Try to get parameters from the first distribution with valid parameters
    if "distributions" in data and data["distributions"]:
        for dist_id, dist_data in data["distributions"].items():
            if "parameters" in dist_data:
                
                params = dist_data["parameters"]
                print(f"Processing with parameters: {params}")
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except:
                        continue
                
                if isinstance(params, dict):
                    default_agent_radius = params.get("radius", default_agent_radius)
                    default_v0 = params.get("v0", default_v0)
                    default_n_agents = params.get("number", default_n_agents)
                    break  
    
    # # Default parameters
    # default_agent_radius = 0.2
    # default_v0 = 1.2
    # default_n_agents = 100
    
    # Override defaults with global parameters if provided
    if global_parameters:
        default_v0 = getattr(global_parameters, 'v0', default_v0)
        default_agent_radius = getattr(global_parameters, 'radius', default_agent_radius)
        default_n_agents = getattr(global_parameters, 'number', default_n_agents)

    print(f"Using default parameters: v0={default_v0}, radius={default_agent_radius}, n_agents={default_n_agents}")

    print()
    # Step 1: Add exits to simulation
    stage_map = {}
    exits = []
    
    for exit_id, exit_data in data.get("exits", {}).items():
        if "coordinates" in exit_data:
            coords = exit_data["coordinates"]
            if isinstance(coords, list) and len(coords) >= 3:
                exit_polygon = Polygon(coords)
                exits.append(exit_polygon)
                stage_map[exit_id] = simulation.add_exit_stage(exit_polygon)
    
    if not exits:
        raise ValueError("No valid exits found in configuration")

    # Step 2: Handle distributions (use walkable area if none provided)
    distributions = []
    distribution_params = []  # Store parameters for each distribution
    total_agents = 0

    if "distributions" in data and data["distributions"]:
        # Use provided distributions
        for dist_id, dist_data in data["distributions"].items():
            if "coordinates" in dist_data:
                coords = dist_data["coordinates"]
                if isinstance(coords, list) and len(coords) >= 3:
                    dist_polygon = Polygon(coords)
                    distributions.append(dist_polygon)
                    
                    # Get parameters for this specific distribution
                    params = dist_data.get("parameters", {})
                    if isinstance(params, str):
                        try:
                            params = json.loads(params)
                        except:
                            params = {}
                    
                    # Use distribution-specific parameters or fall back to defaults
                    dist_params = {
                        'number': params.get('number', default_n_agents),
                        'radius': params.get('radius', default_agent_radius),
                        'v0': params.get('v0', default_v0)
                    }
                    
                    distribution_params.append(dist_params)
                    total_agents += int(dist_params['number'])
                    
                    print(f"Distribution {dist_id}: {dist_params}")

    # Fallback: use walkable area if no valid distributions
    if not distributions:
        print("No valid distributions found; using walkable area as fallback")
        distributions = [walkable_area.polygon]
        distribution_params = [{
            'number': default_n_agents,
            'radius': default_agent_radius,
            'v0': default_v0
        }]
        total_agents = default_n_agents

    # Step 3: Create default journeys (one per exit)
    journey_ids = {}
    exit_to_journey = {}
    
    for exit_id, exit_stage_id in stage_map.items():
        journey_desc = jps.JourneyDescription([exit_stage_id])
        journey_id = simulation.add_journey(journey_desc)
        journey_ids[f"journey_to_{exit_id}"] = journey_id
        exit_to_journey[exit_stage_id] = journey_id

    # Step 4: Handle obstacles (holes in walkable area)
    holes = [Polygon(interior) for interior in walkable_area.polygon.interiors]
    obstacles_union = unary_union(holes) if holes else None

    # Step 5: Distribute agents and assign to nearest exits
    all_positions = []
    agent_radii = {}
    agent_counter = 0

    np.random.seed(seed)

    # Use distribution-specific parameters for each area
    for i, (dist_area, dist_params) in enumerate(zip(distributions, distribution_params)):
        # Remove obstacles from distribution area
        if obstacles_union and not obstacles_union.is_empty:
            dist_area = dist_area.difference(obstacles_union)
        
        # Use the specific number of agents for this distribution
        agents_for_this_area = int(dist_params['number'])
        
        if agents_for_this_area <= 0:
            continue
            
        try:
            # Ensure distribution area is within walkable area
            dist_area = shapely.intersection(dist_area, walkable_area.polygon)
            
            if dist_area.is_empty:
                print(f"Warning: Distribution area {i} is outside walkable area")
                continue
                
            positions = jps.distribute_by_number(
                polygon=dist_area,
                number_of_agents=agents_for_this_area,
                distance_to_agents=0.4,
                distance_to_polygon=0.2,
                seed=seed + i,
            )
        except Exception as e:
            print(f"Warning: Failed to distribute agents in area {i}: {e}")
            continue
        
        # Add agents with nearest exit assignment using distribution-specific parameters
        for pos in positions:
            # Find nearest exit
            nearest_exit_stage_id = _find_nearest_exit(pos, stage_map, exits)
            nearest_journey_id = exit_to_journey[nearest_exit_stage_id]
            
            # Create agent parameters using distribution-specific values
            agent_params = create_agent_parameters(
                model_type=model_type,
                position=pos,
                params={
                    "v0": dist_params['v0'],
                    "radius": dist_params['radius']
                },
                global_params=global_parameters,
                journey_id=nearest_journey_id,
                stage_id=nearest_exit_stage_id
            )
            
            agent_id = simulation.add_agent(agent_params)
            all_positions.append(pos)
            agent_radii[agent_id] = dist_params['radius']  # Use distribution-specific radius
            agent_counter += 1

    print(f"Added {len(all_positions)} agents using fallback logic with {len(exits)} exits")
    
    return {
        "stage_map": stage_map,
        "journey_ids": journey_ids,
    }, all_positions, agent_radii

def _find_nearest_exit(position: tuple, stage_map: dict, exits: list) -> int:
    """Find the stage ID of the nearest exit to the given position"""
    from shapely.geometry import Point
    
    point = Point(position)
    min_distance = float('inf')
    nearest_stage_id = None
    
    exit_idx = 0
    for exit_id, stage_id in stage_map.items():
        if exit_idx < len(exits):
            exit_geom = exits[exit_idx]
            distance = point.distance(exit_geom)
            
            if distance < min_distance:
                min_distance = distance
                nearest_stage_id = stage_id
            
            exit_idx += 1
    
    return nearest_stage_id if nearest_stage_id is not None else list(stage_map.values())[0]
def _add_stages(simulation: jps.Simulation, data: Dict[str, Any]) -> Dict[str, int]:
    """Add waypoints and exits to the simulation."""
    stage_map = {}

    for wp_id, wp_data in data.get("waypoints", {}).items():
        center = wp_data["center"]
        radius = wp_data["radius"]
        stage_map[wp_id] = simulation.add_waypoint_stage(center, radius)

    for exit_id, exit_data in data.get("exits", {}).items():
        polygon = exit_data["coordinates"]
        stage_map[exit_id] = simulation.add_exit_stage(polygon)

    return stage_map


def _process_distributions(data: Dict[str, Any]) -> Tuple[Dict[str, List[List[float]]], Dict[str, Dict[str, Any]]]:
    """Process distribution geometries from JSON."""
    dist_geom = {}
    dist_params = {}
    
    for dist_id, dist_data in data.get("distributions", {}).items():
        dist_geom[dist_id] = dist_data["coordinates"]
        
        params = dist_data.get("parameters", {})
        if isinstance(params, str):
            try:
                params = json.loads(params)
            except json.JSONDecodeError:
                params = {'number': 10, 'radius': 0.2, 'v0': 1.2}
        elif not isinstance(params, dict):
            params = {'number': 10, 'radius': 0.2, 'v0': 1.2}
        
        dist_params[dist_id] = {
            'number': params.get('number', 10),
            'radius': params.get('radius', 0.2),
            'v0': params.get('v0', 1.2)
        }
        
    return dist_geom, dist_params

def _create_journeys_with_percentages(
    simulation: jps.Simulation, 
    data: Dict[str, Any], 
    stage_map: Dict[str, int]
) -> Dict[str, Any]:
    """Enhanced journey creation with percentage-based routing"""
    
    journey_ids = {}
    journey_variants = {}
    waypoint_routing = data.get("waypoint_routing", {})
    journey_endpoints = {}
    
    print(f"Creating journeys with routing: {waypoint_routing}")
    
    # First, create journey variants based on percentage routing
    for journey in data.get("journeys", []):
        jid = journey["id"]
        base_stages = journey["stages"]
        
        print(f"Processing journey {jid} with stages: {base_stages}")
        
        # Generate all possible journey variants for this journey
        variants = _generate_journey_variants(jid, base_stages, waypoint_routing, stage_map)
        journey_variants[jid] = []
        
        print(f"Generated {len(variants)} variants for journey {jid}")
        
        for variant_idx, (variant_stages, percentage) in enumerate(variants):
            variant_id = f"{jid}_variant_{variant_idx}"
            
            print(f"Creating variant {variant_id}: {variant_stages} ({percentage}%)")
            
            # Create JuPedSim journey for this variant
            stage_ids = [stage_map[k] for k in variant_stages if k in stage_map]
            if len(stage_ids) >= 2:  # Need at least start and end
                jd = jps.JourneyDescription(stage_ids)
                
                # Set linear transitions for this variant
                for i in range(len(stage_ids) - 1):
                    jd.set_transition_for_stage(
                        stage_ids[i], 
                        jps.Transition.create_fixed_transition(stage_ids[i + 1])
                    )
                
                variant_journey_id = simulation.add_journey(jd)
                journey_variants[jid].append({
                    'id': variant_journey_id,
                    'stages': variant_stages,
                    'percentage': percentage,
                    'variant_name': variant_id
                })
                
                # Store journey endpoints for compatibility
                dist_key = variant_stages[0] if variant_stages else None
                exit_key = variant_stages[-1] if variant_stages else None
                if dist_key and exit_key:
                    journey_endpoints[variant_id] = (dist_key, exit_key)
    
    # Create journeys_per_distribution for compatibility
    journeys_per_distribution = defaultdict(list)
    for jid, variants in journey_variants.items():
        for variant in variants:
            dist_key = variant['stages'][0] if variant['stages'] else None
            if dist_key:
                journeys_per_distribution[dist_key].append({
                    'original_journey_id': jid,
                    'variant_data': variant
                })
    
    return {
        "journey_ids": journey_ids,  # Keep for compatibility
        "journey_variants": journey_variants,
        "journey_endpoints": journey_endpoints,
        "journeys_per_distribution": journeys_per_distribution,
        "waypoint_routing": waypoint_routing
    }

def _generate_journey_variants(journey_id: str, base_stages: List[str], waypoint_routing: Dict, stage_map: Dict[str, int]) -> List[Tuple[List[str], float]]:
    """Generate all possible journey variants with their percentages"""
    
    if not waypoint_routing:
        return [(base_stages, 100.0)]
    
    variants = []
    
    def _explore_paths_recursive(current_path: List[str], current_percentage: float, current_stage: str, visited: set):
        """Recursively explore all possible paths from current stage"""
        
        # Prevent infinite loops
        if current_stage in visited:
            # If we've visited this stage before, treat it as a terminal (shouldn't happen with proper config)
            if current_path:
                variants.append((current_path.copy(), current_percentage))
            return
        
        visited.add(current_stage)
        current_path.append(current_stage)
        
        # Check if this stage has routing rules for this journey
        if (current_stage in waypoint_routing and 
            journey_id in waypoint_routing[current_stage]):
            
            routing_config = waypoint_routing[current_stage][journey_id]
            destinations = routing_config.get("destinations", [])
            
            if destinations:
                # This stage has routing - branch to each destination
                current_path.pop()  # Remove current stage, we'll add it back for each branch
                
                for dest_config in destinations:
                    target = dest_config["target"]
                    percentage = dest_config["percentage"]
                    
                    # Create new branch
                    branch_path = current_path.copy()
                    branch_path.append(current_stage)  # Add the routing waypoint
                    branch_percentage = current_percentage * (percentage / 100.0)
                    branch_visited = visited.copy()
                    
                    # Recursively explore from the target
                    _explore_paths_recursive(branch_path, branch_percentage, target, branch_visited)
            else:
                # No destinations defined, treat as terminal
                if current_path:
                    variants.append((current_path.copy(), current_percentage))
        else:
            # No routing rules for this stage - treat as terminal (final destination)
            if current_path:
                variants.append((current_path.copy(), current_percentage))
    
    # Start exploration from the first waypoint after distribution
    if len(base_stages) > 1:  # Skip distribution, start from first waypoint
        start_path = [base_stages[0]]  # Include distribution
        _explore_paths_recursive(start_path, 100.0, base_stages[1], set())
    else:
        return [(base_stages, 100.0)]
    
    return variants if variants else [(base_stages, 100.0)]

# Update the main function name call
def _create_journeys(simulation: jps.Simulation, data: Dict[str, Any], stage_map: Dict[str, int]) -> Dict[str, Any]:
    """Wrapper to maintain compatibility"""
    return _create_journeys_with_percentages(simulation, data, stage_map)

def _add_agents(
    simulation: jps.Simulation,
    data: Dict[str, Any],
    stage_map: Dict[str, int],
    dist_geom: Dict[str, List[List[float]]],
    dist_params: Dict[str, Dict[str, Any]],
    journey_data: Dict[str, Any],
    walkable_area: pedpy.WalkableArea,
    seed: int,
    model_type: str = "CollisionFreeSpeedModel",
    global_parameters=None,
) -> Tuple[List[Tuple[float, float]], Dict[int, float]]:
    """Add agents to the simulation based on distributions and journeys."""
    journey_ids = journey_data["journey_ids"]
    journeys_per_distribution = journey_data["journeys_per_distribution"]
    
    np.random.seed(seed)
    all_positions = []
    agent_radii = {}
    current_agent_id = 0
    
    # Create individual journeys for each exit (for agents without predefined journeys)
    exit_to_journey = {}
    exit_geometries = {}
    
    # First, create a journey for each exit that doesn't already have one
    for exit_id, exit_data in data.get("exits", {}).items():
        if exit_id in stage_map:
            stage_id = stage_map[exit_id]
            
            # Create geometry for distance calculation
            if "coordinates" in exit_data:
                exit_geometries[stage_id] = Polygon(exit_data["coordinates"])
            
            # Check if this exit already has a journey from the existing journeys
            exit_has_journey = False
            for journey_def in data.get("journeys", []):
                if journey_def["id"] in journey_ids:
                    if exit_id in journey_def.get("stages", []):
                        exit_has_journey = True
                        exit_to_journey[stage_id] = journey_ids[journey_def["id"]]
                        break
            
            # If no existing journey goes to this exit, create one
            if not exit_has_journey:
                journey_desc = jps.JourneyDescription([stage_id])
                new_journey_id = simulation.add_journey(journey_desc)
                exit_to_journey[stage_id] = new_journey_id
                print(f"Created new journey {new_journey_id} for exit {exit_id}")
    
    def find_nearest_exit_journey(agent_position):
        """Find the nearest exit and return its journey_id and stage_id"""
        if not exit_geometries:
            # Fallback to first available journey
            if exit_to_journey:
                stage_id = list(exit_to_journey.keys())[0]
                return exit_to_journey[stage_id], stage_id
            else:
                raise ValueError("No exits available for agent assignment")
        
        from shapely.geometry import Point
        agent_point = Point(agent_position)
        min_distance = float('inf')
        nearest_stage_id = None
        
        for stage_id, exit_geometry in exit_geometries.items():
            distance = agent_point.distance(exit_geometry)
            if distance < min_distance:
                min_distance = distance
                nearest_stage_id = stage_id
        
        if nearest_stage_id is not None and nearest_stage_id in exit_to_journey:
            return exit_to_journey[nearest_stage_id], nearest_stage_id
        else:
            # Fallback
            stage_id = list(exit_to_journey.keys())[0]
            return exit_to_journey[stage_id], stage_id
    
    # In _add_agents function, find the section where agents are assigned to journeys
    # Replace the journey assignment logic with:

    journey_variants = journey_data.get("journey_variants", {})
    journeys_per_distribution = journey_data["journeys_per_distribution"]

    # Process distributions with journey variants
    for dist_key, polygon in dist_geom.items():
        params = dist_params[dist_key]
        agent_radius = params.get("radius", 0.2)
        n_agents = int(params.get("number", 0))
        
        if n_agents <= 0:
            continue
        
        try:
            polygon_obj = Polygon(polygon)
            dist_area = shapely.intersection(polygon_obj, walkable_area.polygon)
            
            if dist_area.is_empty:
                print(f"Warning: Distribution {dist_key} is outside walkable area")
                continue
                
            positions = jps.distribute_by_number(
                polygon=dist_area,
                number_of_agents=n_agents,
                distance_to_agents=0.4,
                distance_to_polygon=0.2,
                seed=seed,
            )
            
            all_positions.extend(positions)
            
        except Exception as e:
            print(f"Warning: Error distributing agents in {dist_key}: {e}")
            continue
        
        # Check if this distribution has journeys with variants
        distribution_journeys = journeys_per_distribution.get(dist_key, [])
        
        if distribution_journeys:
            print(f"Distribution {dist_key} has {len(distribution_journeys)} journey variants")
            
            v0_mean = params.get("v0", 1.2)
            v_distribution = np.random.normal(v0_mean, 0.26, n_agents).clip(0.1, 2.0)
            
            # Calculate total percentage weight
            total_weight = sum(variant_info['variant_data']['percentage'] for variant_info in distribution_journeys)
            
            agent_index = 0
            for variant_info in distribution_journeys:
                variant_data = variant_info['variant_data']
                variant_percentage = variant_data['percentage']
                
                # Calculate agents for this variant
                variant_agents = int((n_agents * variant_percentage) / total_weight)
                
                if variant_agents <= 0:
                    continue
                
                print(f"Assigning {variant_agents} agents to variant {variant_data['variant_name']}")
                
                # Find first valid stage after distribution
                variant_stages = variant_data['stages']
                start_stage_key = None
                for stage in variant_stages[1:]:  # Skip distribution
                    if stage in stage_map:
                        start_stage_key = stage
                        break
                
                if start_stage_key:
                    for j in range(variant_agents):
                        if agent_index < len(positions):
                            pos = positions[agent_index]
                            v0 = v_distribution[agent_index] if agent_index < len(v_distribution) else v0_mean
                            
                            agent_params = create_agent_parameters(
                                model_type=model_type,
                                position=pos,
                                params={"v0": v0, "radius": agent_radius},
                                global_params=global_parameters,
                                journey_id=variant_data['id'],
                                stage_id=stage_map[start_stage_key]
                            )
                            
                            agent_id = simulation.add_agent(agent_params)
                            agent_radii[agent_id] = agent_radius
                            agent_index += 1
                            current_agent_id += 1
        else:
            # No journey variants, use existing fallback logic
            print(f"Distribution {dist_key} has no journey variants - using nearest exit assignment")
            
            for pos in positions:
                nearest_journey_id, nearest_stage_id = find_nearest_exit_journey(pos)
                
                agent_params = create_agent_parameters(
                    model_type=model_type,
                    position=pos,
                    params=params,
                    global_params=global_parameters,
                    journey_id=nearest_journey_id,
                    stage_id=nearest_stage_id
                )
                
                agent_id = simulation.add_agent(agent_params)
                agent_radii[agent_id] = agent_radius
                current_agent_id += 1
    return all_positions, agent_radii