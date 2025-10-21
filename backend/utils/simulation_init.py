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
        
    if ("journeys" not in data or not data["journeys"]) and ("transitions" not in data or not data["transitions"]):
        needs_fallback = True
        fallback_reasons.append("No journeys or transitions defined")

    if "waypoints" not in data:
        data["waypoints"] = {}
        
    if "transitions" not in data:
        data["transitions"] = []

    if needs_fallback:
        print(f"Using fallback logic: {', '.join(fallback_reasons)}")

        result_data, positions, agent_radii, spawning_info = _initialize_with_fallback(
            simulation, data, walkable_area, seed, model_type, global_parameters
        )
        # Return empty spawning_info for fallback
        return result_data, positions, agent_radii, spawning_info
    else:
        # Use original logic for complete configurations
        result_data, positions, agent_radii, spawning_info = _initialize_complete_config(
            simulation, data, walkable_area, seed, model_type, global_parameters
        )
        return result_data, positions, agent_radii, spawning_info

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

    positions, agent_radii, spawning_info = _add_agents(
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
    }, positions, agent_radii, spawning_info

def _initialize_with_fallback(
    simulation: jps.Simulation,
    data: Dict[str, Any],
    walkable_area: pedpy.WalkableArea,
    seed: int,
    model_type: str,
    global_parameters=None,
) -> Tuple[Dict[str, Any], List[Tuple[float, float]], Dict[int, float], Dict[str, Any]]:
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
                        'v0': params.get('v0', default_v0),
                        'use_flow_spawning': params.get('use_flow_spawning', False),
                        'flow_start_time': params.get('flow_start_time', 0),
                        'flow_end_time': params.get('flow_end_time', 10)
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
            'v0': default_v0,
            'use_flow_spawning': False,
            'flow_start_time': 0,
            'flow_end_time': 10
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

    # Step 5: Handle flow spawning vs immediate spawning
    spawning_freqs_and_numbers = []
    starting_pos_per_source = []
    num_agents_per_source = []
    flow_distributions = []
    has_flow_spawning = False

    all_positions = []
    agent_radii = {}
    agent_counter = 0

    immediate_spawn_distributions = []

    np.random.seed(seed)

    # Separate flow spawning from immediate spawning
    for i, (dist_area, dist_params) in enumerate(zip(distributions, distribution_params)):
        use_flow_spawning = dist_params.get('use_flow_spawning', False)
        n_agents = int(dist_params['number'])
        
        if n_agents <= 0:
            continue
            
        # Remove obstacles from distribution area
        if obstacles_union and not obstacles_union.is_empty:
            clean_dist_area = dist_area.difference(obstacles_union)
        else:
            clean_dist_area = dist_area
            
        # Ensure distribution area is within walkable area
        clean_dist_area = shapely.intersection(clean_dist_area, walkable_area.polygon)
        
        if clean_dist_area.is_empty:
            print(f"Warning: Distribution area {i} is outside walkable area")
            continue
        
        if use_flow_spawning:
            has_flow_spawning = True
            
            # Get flow parameters
            flow_start_time = max(0, dist_params.get('flow_start_time', 0))
            flow_end_time = max(flow_start_time + 0.1, dist_params.get('flow_end_time', 10))
            flow_duration = flow_end_time - flow_start_time
            
            # Calculate frequency (seconds between spawns)
            frequency = flow_duration / n_agents if n_agents > 0 else 1.0
            agents_per_spawn = 1  # spawn 1 agent at a time for smooth flow
            
            spawning_freqs_and_numbers.append([frequency, agents_per_spawn])
            num_agents_per_source.append(n_agents)
            
            # Pre-calculate positions for flow spawning
            positions = jps.distribute_until_filled(
                polygon=clean_dist_area,
                distance_to_agents=0.3,
                distance_to_polygon=0.15,
                seed=seed + i
            )
            
            import random
            random.seed(seed + i)
            random.shuffle(positions)
            starting_pos_per_source.append(positions)
            
            # Store flow distribution info
            flow_distributions.append({
                'dist_index': i,
                'params': dist_params,
                'start_time': flow_start_time,
                'end_time': flow_end_time,
                'area': clean_dist_area
            })
            
            print(f"Flow spawning: Distribution {i} - {n_agents} agents over {flow_duration}s")
            
        else:
            # Store for immediate spawning
            immediate_spawn_distributions.append({
                'area': clean_dist_area,
                'params': dist_params,
                'index': i
            })

    # Handle immediate spawning
    for spawn_data in immediate_spawn_distributions:
        try:
            positions = jps.distribute_by_number(
                polygon=spawn_data['area'],
                number_of_agents=int(spawn_data['params']['number']),
                distance_to_agents=0.4,
                distance_to_polygon=0.2,
                seed=seed + spawn_data['index'],
            )
        except Exception as e:
            error_msg = (
                f"CRITICAL: Failed to place agents in distribution area {spawn_data['index']}. "
                f"Error: {str(e)}. This usually means the spawn area is too small or crowded. "
                f"Consider: 1) Making the distribution area larger, 2) Reducing the number of agents, "
                f"3) Increasing distance between agents, or 4) Checking for obstacles in the area."
            )
            print(f"ERROR: {error_msg}")
            raise Exception(error_msg)
        
        # Add agents with nearest exit assignment
        for pos in positions:
            nearest_exit_stage_id = _find_nearest_exit(pos, stage_map, exits)
            nearest_journey_id = exit_to_journey[nearest_exit_stage_id]
            
            agent_params = create_agent_parameters(
                model_type=model_type,
                position=pos,
                params=spawn_data['params'],
                global_params=global_parameters,
                journey_id=nearest_journey_id,
                stage_id=nearest_exit_stage_id
            )
            
            agent_id = simulation.add_agent(agent_params)
            all_positions.append(pos)
            agent_radii[agent_id] = spawn_data['params']['radius']
            agent_counter += 1

    # Prepare spawning info for flow spawning
    agent_counter_per_source = [0] * len(flow_distributions)
    
    spawning_info = {
        'has_flow_spawning': has_flow_spawning,
        'spawning_freqs_and_numbers': spawning_freqs_and_numbers,
        'starting_pos_per_source': starting_pos_per_source,
        'num_agents_per_source': num_agents_per_source,
        'agent_counter_per_source': agent_counter_per_source,
        'flow_distributions': flow_distributions,
        'model_type': model_type,
        'global_parameters': global_parameters,
        'stage_map': stage_map,
        'exit_to_journey': exit_to_journey,
        'exits': exits
    }

    print(f"Added {len(all_positions)} agents using fallback logic (immediate), prepared {len(flow_distributions)} flow sources")
    
    return {
        "stage_map": stage_map,
        "journey_ids": journey_ids,
    }, all_positions, agent_radii, spawning_info

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

    for dist_id, dist_data in data.get("distributions", {}).items():
        # Distributions don't need to be added as stages in JuPedSim,
        # but we need them in stage_map for journey creation
        stage_map[dist_id] = -1

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
            'v0': params.get('v0', 1.2),
            # ADD THESE FLOW PARAMETERS:
            'use_flow_spawning': params.get('use_flow_spawning', False),
            'flow_start_time': params.get('flow_start_time', 0),
            'flow_end_time': params.get('flow_end_time', 10)
        }
        
        # ADD DEBUG LOG:
        print(f"DEBUG: Distribution {dist_id} processed params: {dist_params[dist_id]}")
        
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
            
            # Filter out distributions - JuPedSim journeys only contain waypoints and exits
            actual_stages = [stage for stage in variant_stages if not stage.startswith('jps-distributions_')]
            stage_ids = [stage_map[k] for k in actual_stages if k in stage_map]
            
            if len(stage_ids) >= 1:  # Need at least one actual stage (exit)
                jd = jps.JourneyDescription(stage_ids)
                
                # Set linear transitions for this variant (only between actual stages)
                for i in range(len(stage_ids) - 1):
                    jd.set_transition_for_stage(
                        stage_ids[i], 
                        jps.Transition.create_fixed_transition(stage_ids[i + 1])
                    )
                
                variant_journey_id = simulation.add_journey(jd)
                journey_variants[jid].append({
                    'id': variant_journey_id,
                    'stages': variant_stages,  # Keep original stages for reference
                    'actual_stages': actual_stages,  # Add filtered stages
                    'percentage': percentage,
                    'variant_name': variant_id
                })
                
                # Store journey endpoints for compatibility
                dist_key = variant_stages[0] if variant_stages else None
                exit_key = variant_stages[-1] if variant_stages else None
                if dist_key and exit_key:
                    journey_endpoints[variant_id] = (dist_key, exit_key)
    
    # Create journeys_per_distribution for compatibility
    # **UPDATED: Handle all distributions that should follow the same journey**
    journeys_per_distribution = defaultdict(list)
    for jid, variants in journey_variants.items():
        for variant in variants:
            # Find ALL distributions that should follow this journey
            journey_def = None
            for j in data.get("journeys", []):
                if j["id"] == jid:
                    journey_def = j
                    break
            
            if journey_def:
                # Get all distributions from the original journey stages
                distributions_in_journey = [stage for stage in journey_def["stages"] if stage.startswith('jps-distributions_')]
                
                print(f"DEBUG: Journey {jid} has distributions: {distributions_in_journey}")
                
                # Add this variant to ALL distributions in the journey
                for dist_key in distributions_in_journey:
                    journeys_per_distribution[dist_key].append({
                        'original_journey_id': jid,
                        'variant_data': variant
                    })
                    print(f"DEBUG: Added variant to distribution {dist_key}")
    
    print(f"DEBUG: journey_variants = {journey_variants}")
    print(f"DEBUG: journeys_per_distribution keys = {list(journeys_per_distribution.keys())}")
    print(f"DEBUG: journeys_per_distribution = {dict(journeys_per_distribution)}")  
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
    
    # Find ALL distributions for this journey (not just the first one)
    distributions = [stage for stage in base_stages if stage.startswith('jps-distributions_')]
    if not distributions:
        return [(base_stages, 100.0)]
    
    print(f"DEBUG: Found distributions for journey {journey_id}: {distributions}")
    
    # Find waypoints that could be initial destinations from any distribution
    all_waypoints = [stage for stage in base_stages if stage.startswith('jps-waypoints_')]
    
    # Find waypoints that are targets of routing (not initial waypoints)
    target_waypoints = set()
    for wp, journeys in waypoint_routing.items():
        if journey_id in journeys:
            for dest in journeys[journey_id].get('destinations', []):
                if dest['target'].startswith('jps-waypoints_'):
                    target_waypoints.add(dest['target'])
    
    # Initial waypoints are those with routing rules but not targets of others
    initial_waypoints = []
    for wp in all_waypoints:
        if wp in waypoint_routing and journey_id in waypoint_routing[wp]:
            if wp not in target_waypoints:
                initial_waypoints.append(wp)
    
    print(f"DEBUG: All waypoints: {all_waypoints}")
    print(f"DEBUG: Target waypoints: {target_waypoints}")
    print(f"DEBUG: Initial waypoints: {initial_waypoints}")
    
    if not initial_waypoints:
        return [(base_stages, 100.0)]
    
    # For each initial waypoint, generate all possible paths
    # Use the FIRST distribution as reference (since all distributions in a set follow the same path)
    reference_distribution = distributions[0]
    for initial_wp in initial_waypoints:
        paths = _explore_all_paths_from_waypoint(initial_wp, journey_id, waypoint_routing, [reference_distribution])
        variants.extend(paths)
    
    return variants if variants else [(base_stages, 100.0)]


def _explore_all_paths_from_waypoint(waypoint: str, journey_id: str, waypoint_routing: Dict, path_so_far: List[str]) -> List[Tuple[List[str], float]]:
    """Explore all paths from a given waypoint"""
    current_path = path_so_far + [waypoint]
    
    # Check if this waypoint has routing for this journey
    if waypoint in waypoint_routing and journey_id in waypoint_routing[waypoint]:
        routing_config = waypoint_routing[waypoint][journey_id]
        destinations = routing_config.get("destinations", [])
        
        if destinations:
            # Split into multiple paths based on percentages
            paths = []
            for dest_config in destinations:
                target = dest_config["target"]
                percentage = dest_config["percentage"]
                
                if target.startswith('jps-waypoints_'):
                    # Continue exploring from this waypoint
                    sub_paths = _explore_all_paths_from_waypoint(target, journey_id, waypoint_routing, current_path)
                    # Scale percentages
                    for sub_path, sub_percentage in sub_paths:
                        paths.append((sub_path, percentage * sub_percentage / 100.0))
                else:
                    # This is an exit - terminal path
                    final_path = current_path + [target]
                    paths.append((final_path, percentage))
            
            return paths
    
    # No routing or no destinations - this shouldn't happen, but handle gracefully
    return [(current_path, 100.0)]
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
) -> Tuple[List[Tuple[float, float]], Dict[int, float], Dict[str, Any]]:
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

    # Initialize flow spawning data structures following your pattern
    spawning_freqs_and_numbers = []
    starting_pos_per_source = []
    num_agents_per_source = []
    flow_distributions = []  # Track which distributions use flow
    has_flow_spawning = False
    
    # Process distributions to separate flow vs immediate spawning
    immediate_spawn_distributions = {}
    journey_variants = journey_data.get("journey_variants", {})
    journeys_per_distribution = journey_data["journeys_per_distribution"]

    for dist_key, polygon in dist_geom.items():
        print(f"DEBUG: Processing distribution with dist_key = '{dist_key}'")
        print(f"DEBUG: Available journeys_per_distribution keys = {list(journeys_per_distribution.keys())}")

        params = dist_params[dist_key]
        agent_radius = params.get("radius", 0.2)
        n_agents = int(params.get("number", 0))
        use_flow_spawning = params.get("use_flow_spawning", False)
        
        if n_agents <= 0:
            continue
            
        try:
            polygon_obj = Polygon(polygon)
            dist_area = shapely.intersection(polygon_obj, walkable_area.polygon)
            
            if dist_area.is_empty:
                print(f"Warning: Distribution {dist_key} is outside walkable area")
                continue
            
            # Find journey information for this distribution
            transformed_dist_key = None
            for dist_id, dist_data in data.get("distributions", {}).items():
                if dist_id == dist_key:
                    dist_index = list(data.get("distributions", {}).keys()).index(dist_key)
                    transformed_dist_key = f"jps-distributions_{dist_index}"
                    break

            distribution_journeys = journeys_per_distribution.get(transformed_dist_key, []) if transformed_dist_key else []
            print(f"DEBUG: transformed_dist_key = '{transformed_dist_key}', found {len(distribution_journeys)} distribution_journeys")
            
            if use_flow_spawning:
                has_flow_spawning = True
                
                # Get flow parameters
                flow_start_time = max(0, params.get("flow_start_time", 0))
                flow_end_time = max(flow_start_time + 0.1, params.get("flow_end_time", 10))
                flow_duration = flow_end_time - flow_start_time
                
                # Calculate frequency and agents per spawn following your pattern
                frequency = flow_duration / n_agents if n_agents > 0 else 1.0  # seconds between spawns
                agents_per_spawn = 1  # spawn 1 agent at a time for smooth flow
                
                # Store in your pattern: [frequency, agents_per_spawn]
                spawning_freqs_and_numbers.append([frequency, agents_per_spawn])
                num_agents_per_source.append(n_agents)
                
                # Calculate positions following your pattern
                positions = jps.distribute_until_filled(
                    polygon=dist_area,
                    distance_to_agents=0.3, 
                    distance_to_polygon=0.15, 
                    seed=seed + len(starting_pos_per_source)
                )
                
                import random
                random.seed(seed + hash(dist_key))
                random.shuffle(positions)
                starting_pos_per_source.append(positions)
                
                # Store distribution info for flow spawning
                flow_distributions.append({
                    'dist_key': dist_key,
                    'source_id': len(flow_distributions),
                    'params': params,
                    'start_time': flow_start_time,
                    'end_time': flow_end_time,
                    'journey_info': distribution_journeys
                })
                
                print(f"Flow spawning: {dist_key} - {n_agents} agents over {flow_duration}s (freq: {frequency:.2f}s, rate: {1/frequency:.2f} agents/s)")
                
            else:
                # Store for immediate spawning
                immediate_spawn_distributions[dist_key] = {
                    'polygon': polygon,
                    'params': params,
                    'area': dist_area,
                    'distribution_journeys': distribution_journeys
                }
                
        except Exception as e:
            print(f"Warning: Error processing distribution {dist_key}: {e}")
            continue
    
    # Initialize agent counter per source (your pattern)
    agent_counter_per_source = [0] * len(flow_distributions)
    
    # Handle immediate spawning distributions (existing logic)
    for dist_key, spawn_data in immediate_spawn_distributions.items():
        try:
            positions = jps.distribute_by_number(
                polygon=spawn_data['area'],
                number_of_agents=int(spawn_data['params'].get("number", 0)),
                distance_to_agents=0.4,
                distance_to_polygon=0.2,
                seed=seed,
            )
            
            all_positions.extend(positions)
            
            distribution_journeys = spawn_data['distribution_journeys']
            params = spawn_data['params']
            
            if distribution_journeys:
                print(f"Distribution {dist_key} has {len(distribution_journeys)} journey variants")
                
                v0_mean = params.get("v0", 1.2)
                v_distribution = np.random.normal(v0_mean, 0.26, len(positions)).clip(0.1, 2.0)
                
                # Calculate total percentage weight
                total_weight = sum(variant_info['variant_data']['percentage'] for variant_info in distribution_journeys)
                
                # Calculate agent distribution using proportional allocation
                agent_assignments = []
                remaining_agents = len(positions)
                
                for i, variant_info in enumerate(distribution_journeys):
                    variant_data = variant_info['variant_data']
                    variant_percentage = variant_data['percentage']
                    
                    if i == len(distribution_journeys) - 1:
                        # Last variant gets all remaining agents to ensure exact total
                        variant_agents = remaining_agents
                    else:
                        # Calculate proportional assignment (rounded)
                        variant_agents = round((len(positions) * variant_percentage) / total_weight)
                        # Ensure we don't exceed remaining agents
                        variant_agents = min(variant_agents, remaining_agents)
                    
                    if variant_agents > 0:
                        agent_assignments.append((variant_info, variant_agents))
                        remaining_agents -= variant_agents
                    
                    print(f"Variant {variant_data['variant_name']}: {variant_agents} agents ({variant_percentage}% of {total_weight}%)")
                
                # Verify we're using all agents
                total_assigned = sum(assignment[1] for assignment in agent_assignments)
                print(f"Total agents assigned: {total_assigned}/{len(positions)}")
                
                agent_index = 0
                for variant_info, variant_agents in agent_assignments:
                    variant_data = variant_info['variant_data']
                    
                    # Find first valid stage after distribution
                    variant_stages = variant_data['stages']
                    start_stage_key = None
                    for stage in variant_stages[1:]:  # Skip distribution
                        if stage in stage_map and stage_map[stage] != -1:
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
                                    params={"v0": v0, "radius": params.get("radius", 0.2)},
                                    global_params=global_parameters,
                                    journey_id=variant_data['id'],
                                    stage_id=stage_map[start_stage_key]
                                )
                                
                                agent_id = simulation.add_agent(agent_params)
                                agent_radii[agent_id] = params.get("radius", 0.2)
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
                    agent_radii[agent_id] = params.get("radius", 0.2)
                    current_agent_id += 1
                    
        except Exception as e:
            error_msg = (
                f"CRITICAL: Failed to place agents in distribution '{dist_key}'. "
                f"Error: {str(e)}. This usually means the spawn area is too small or crowded. "
                f"Consider: 1) Making the distribution area larger, 2) Reducing the number of agents, "
                f"3) Increasing distance between agents, or 4) Checking for obstacles in the area."
            )
            print(f"ERROR: {error_msg}")
            raise Exception(error_msg)
    
    # Return spawning info in your pattern format
    spawning_info = {
        'has_flow_spawning': has_flow_spawning,
        'spawning_freqs_and_numbers': spawning_freqs_and_numbers,
        'starting_pos_per_source': starting_pos_per_source,
        'num_agents_per_source': num_agents_per_source,
        'agent_counter_per_source': agent_counter_per_source,
        'flow_distributions': flow_distributions,
        'model_type': model_type,
        'global_parameters': global_parameters,
        'stage_map': stage_map
    }
    
    return all_positions, agent_radii, spawning_info