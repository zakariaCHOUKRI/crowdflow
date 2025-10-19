from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
import os
import pathlib
import tempfile
import json
import time
from typing import Dict, Any, List, Tuple
import jupedsim as jps
import pedpy
from utils.simulation_init import initialize_simulation_from_json,create_agent_parameters
from models import SimulationParameters, SimulationRequest
from utils.validation import calculate_total_agents, validate_and_process_config
from utils.data_processing import get_trajectory_info, get_geometry_wkt
from utils.dependencies import simulation_progress, results_storage

def get_model_instance(model_type: str, parameters: SimulationParameters = None):
    """Create and return the appropriate model instance with parameters"""
    if parameters is None:
        parameters = SimulationParameters()
    
    if model_type == "CollisionFreeSpeedModel":
        return jps.CollisionFreeSpeedModel(
            strength_neighbor_repulsion=parameters.strength_neighbor_repulsion,
            range_neighbor_repulsion=parameters.range_neighbor_repulsion
        )
    elif model_type == "CollisionFreeSpeedModelV2":
        return jps.CollisionFreeSpeedModelV2()
    elif model_type == "GeneralizedCentrifugalForceModel":
        return jps.GeneralizedCentrifugalForceModel()
    elif model_type == "SocialForceModel":
        return jps.SocialForceModel()
    elif model_type == "AnticipationVelocityModel":
        return jps.AnticipationVelocityModel()
    else:
        raise ValueError(f"Unknown model type: {model_type}")
    

def update_progress(simulation_id: str, stage: str, progress: float, message: str = ""):
    """Update progress for a simulation"""
    simulation_progress[simulation_id] = {
        "stage": stage,
        "progress": progress,
        "message": message,
        "timestamp": time.time()
    }

def run_simulation_with_visualization_progress(
   json_path: str, 
   walkable_area: pedpy.WalkableArea, 
   parameters: SimulationParameters,
   simulation_id: str,
   seed: int = 420
) -> tuple[Dict[str, Any], str, Dict[int, float], str]:
   """Run simulation with progress updates and return metrics plus trajectory data"""
   start_time = time.time()
   total_start_time = time.time()
   try:
       update_progress(simulation_id, "setup", 0, "Initializing simulation...")
       
       temp_output = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
       output_file = temp_output.name
       temp_output.close()
       
       update_progress(simulation_id, "setup", 5, "Creating simulation model...")
       
       model = get_model_instance(parameters.model_type, parameters)
       
       simulation = jps.Simulation(
           model=model,
           geometry=walkable_area.polygon,
           trajectory_writer=jps.SqliteTrajectoryWriter(
               output_file=pathlib.Path(output_file), 
               every_nth_frame=4
           ),
       )
       
       update_progress(simulation_id, "setup", 10, "Loading configuration...")
       
       with open(json_path, 'r') as f:
           config = json.load(f)
       
       update_progress(simulation_id, "config", 15, "Validating configuration...")
       
       processed_config = validate_and_process_config(config)
       expected_total_agents = calculate_total_agents(processed_config)
       
       with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
           json.dump(processed_config, temp_file, indent=2)
           processed_json_path = temp_file.name
       
       update_progress(simulation_id, "config", 20, f"Initializing {expected_total_agents} agents...")
       
       _, positions, agent_radii, spawning_info = initialize_simulation_from_json(
           processed_json_path, 
           simulation, 
           walkable_area, 
           seed=seed,
           model_type=parameters.model_type,
           global_parameters=parameters
       )
       
       initial_agent_count = simulation.agent_count()
       
       # Extract spawning data following your pattern
       has_flow_spawning = spawning_info.get('has_flow_spawning', False)
       spawning_freqs_and_numbers = spawning_info.get('spawning_freqs_and_numbers', [])
       starting_pos_per_source = spawning_info.get('starting_pos_per_source', [])
       num_agents_per_source = spawning_info.get('num_agents_per_source', [])
       agent_counter_per_source = spawning_info.get('agent_counter_per_source', [])
       flow_distributions = spawning_info.get('flow_distributions', [])

       print(f"DEBUG: has_flow_spawning = {has_flow_spawning}")
       print(f"DEBUG: spawning_freqs_and_numbers = {spawning_freqs_and_numbers}")
       print(f"DEBUG: num_agents_per_source = {num_agents_per_source}")
       print(f"DEBUG: len(flow_distributions) = {len(flow_distributions)}")
       if flow_distributions:
           for i, dist in enumerate(flow_distributions):
               print(f"DEBUG: flow_distributions[{i}] = {dist}")
       
       steps_per_second = 25  # JuPedSim simulation frequency
       
       update_progress(simulation_id, "agents", 30, f"Initialized {initial_agent_count} agents")
       
       max_iterations = int(parameters.max_simulation_time * 59)
       progress_update_interval = max(1, max_iterations // 100)
       last_reported_progress = 30
       update_progress(simulation_id, "simulation", 30, "Starting simulation...")
       
       # Debug initial state
       if has_flow_spawning:
           print(f"DEBUG: Starting simulation with flow spawning enabled")
           print(f"DEBUG: steps_per_second = {steps_per_second}")
           for i, freq_data in enumerate(spawning_freqs_and_numbers):
               interval_steps = int(freq_data[0] * steps_per_second)
               print(f"DEBUG: Source {i} - frequency: {freq_data[0]}s, interval_steps: {interval_steps}")
       
       while (simulation.elapsed_time() < parameters.max_simulation_time and 
       (simulation.agent_count() > 0 or 
        (has_flow_spawning and sum(agent_counter_per_source) < sum(num_agents_per_source)))):
           
           # Your exact spawning pattern
           if has_flow_spawning:
               current_time = simulation.elapsed_time()
               current_iteration = simulation.iteration_count()
               
               # ADD DEBUG (only log every 25 iterations to avoid spam)
            #    if current_iteration % 25 == 0:
            #        print(f"DEBUG: Flow spawning check - time: {current_time:.2f}s, iteration: {current_iteration}")
               
               for source_id in range(len(spawning_freqs_and_numbers)):
                   if source_id >= len(flow_distributions):
                       continue
                       
                   flow_dist = flow_distributions[source_id]
                   
                   # Check if we're in the spawning time window
                   in_time_window = (current_time >= flow_dist['start_time'] and 
                                    current_time <= flow_dist['end_time'])
                   
                
                   
                   # Calculate spawn interval
                   spawn_frequency = spawning_freqs_and_numbers[source_id][0]  # seconds between spawns
                   next_spawn_time = flow_dist['start_time'] + (agent_counter_per_source[source_id] * spawn_frequency)
                   
                   agents_spawned = agent_counter_per_source[source_id]
                   agents_to_spawn = num_agents_per_source[source_id]
                   
                   # More detailed condition check
                   should_spawn = (agents_spawned < agents_to_spawn and current_time >= next_spawn_time)
                   
                  
                   
                   if should_spawn:
                       
                       # spawn required number of agents
                       for i in range(spawning_freqs_and_numbers[source_id][1]):
                           # loop over possible positions
                           spawned_this_attempt = False
                           for j in range(len(starting_pos_per_source[source_id])):
                               pos_index = (agent_counter_per_source[source_id] + j) % len(starting_pos_per_source[source_id])
                               position = starting_pos_per_source[source_id][pos_index]
                               
                               
                               # Create agent parameters
                               flow_params = flow_dist['params']
                               
                               try:
                                   agent_parameters = create_agent_parameters(
                                       model_type=spawning_info['model_type'],
                                       position=position,
                                       params=flow_params,
                                       global_params=spawning_info['global_parameters'],
                                       journey_id=None,
                                       stage_id=None
                                   )
                                   
                                   # Handle journey assignment - fallback and complete cases
                                   if 'journey_info' in flow_dist and flow_dist['journey_info']:
                                       # Complete config case - select variant based on percentage
                                       distribution_journeys = flow_dist['journey_info']
                                       
                                       # Calculate total percentage weight
                                       total_weight = sum(variant_info['variant_data']['percentage'] for variant_info in distribution_journeys)
                                       
                                       # Select variant based on weighted random selection
                                       import random
                                       rand_val = random.random() * total_weight
                                       cumulative_weight = 0
                                       selected_variant = None
                                       
                                       for variant_info in distribution_journeys:
                                           variant_data = variant_info['variant_data']
                                           cumulative_weight += variant_data['percentage']
                                           if rand_val <= cumulative_weight:
                                               selected_variant = variant_data
                                               break
                                       
                                       # Fallback to first variant if selection fails
                                       if selected_variant is None:
                                           selected_variant = distribution_journeys[0]['variant_data']
                                       
                                       agent_parameters.journey_id = selected_variant['id']
                                       
                                       # Find first valid stage
                                       for stage in selected_variant['stages'][1:]:
                                           if stage in spawning_info['stage_map'] and spawning_info['stage_map'][stage] != -1:
                                               agent_parameters.stage_id = spawning_info['stage_map'][stage]
                                               print(f"DEBUG: Flow agent assigned to journey {selected_variant['id']} ({selected_variant.get('percentage', 0)}%), stage {spawning_info['stage_map'][stage]}")
                                               break
                                   else:
                                       # Fallback case - assign to nearest exit
                                       from utils.simulation_init import _find_nearest_exit
                                       nearest_exit_stage_id = _find_nearest_exit(
                                           position, 
                                           spawning_info['stage_map'], 
                                           spawning_info['exits']
                                       )
                                       nearest_journey_id = spawning_info['exit_to_journey'][nearest_exit_stage_id]
                                       
                                       agent_parameters.journey_id = nearest_journey_id
                                       agent_parameters.stage_id = nearest_exit_stage_id
                                       print(f"DEBUG: Fallback - assigned agent to journey {nearest_journey_id}, stage {nearest_exit_stage_id}")
                                   
                                   agent_id = simulation.add_agent(agent_parameters)
                                   agent_radii[agent_id] = flow_params.get("radius", 0.2)
                                   spawned_this_attempt = True
                                   print(f"DEBUG: Successfully spawned agent {agent_id} at time {current_time:.2f}s")
                                   break
                                   
                               except Exception as e:
                                   print(f"DEBUG: Failed to spawn agent at position {position}: {e}")
                                   continue  # Try next position
                           
                           # Check if we failed to spawn after trying all positions
                           if not spawned_this_attempt:
                               error_msg = (
                                   f"Failed to spawn agent for flow source {source_id} at time {current_time:.2f}s. "
                                   f"All {len(starting_pos_per_source[source_id])} spawn positions are blocked. "
                                   f"This indicates the spawn area is too crowded or blocked by other agents. "
                                   f"Consider: 1) Increasing spawn area size, 2) Reducing spawn rate, "
                                   f"3) Adding more spawn positions, or 4) Checking for obstacles in spawn area."
                               )
                               print(f"ERROR: {error_msg}")
                               
                               # Update progress with error and stop simulation
                               update_progress(simulation_id, "failed", 0, error_msg)
                               
                               # Raise exception to stop simulation
                               raise Exception(error_msg)
                           
                           if spawned_this_attempt:
                               agent_counter_per_source[source_id] = agent_counter_per_source[source_id] + 1
                               print(f"DEBUG: Updated counter for source {source_id}: {agent_counter_per_source[source_id]}/{num_agents_per_source[source_id]}")
           
           simulation.iterate()
           
           
           if simulation.iteration_count() % progress_update_interval == 0:
            # Calculate progress based on both time and agent evacuation
            time_progress = min(simulation.elapsed_time() / parameters.max_simulation_time, 1.0)
            
            # Calculate total agents including flow spawning
            total_expected = initial_agent_count
            if has_flow_spawning:
                total_expected += sum(num_agents_per_source)
            
            # For agent progress, use evacuated agents instead of current agents
            evacuated_agents = total_expected - simulation.agent_count()
            if has_flow_spawning:
                evacuated_agents = total_expected - simulation.agent_count() + sum(agent_counter_per_source) - initial_agent_count
            
            agent_progress = (evacuated_agents / total_expected) if total_expected > 0 else 0.0
            
            # Use the maximum of time and agent progress
            simulation_progress = max(time_progress, agent_progress * 0.8)  # Scale agent progress
            
            # Map to progress range and ensure no backwards movement
            calculated_progress = 30 + (simulation_progress * 60)
            total_progress = max(calculated_progress, last_reported_progress)
            last_reported_progress = total_progress
            
            # Ensure we don't exceed 90% during simulation phase
            total_progress = min(total_progress, 90)
            
            remaining_agents = simulation.agent_count()
            elapsed_time = simulation.elapsed_time()
            
            # Add flow spawning info to progress message
            flow_info = ""
            if has_flow_spawning:
                total_spawned = sum(agent_counter_per_source)
                total_to_spawn = sum(num_agents_per_source)
                flow_info = f", Spawned: {total_spawned}/{total_to_spawn}"
            
            update_progress(
                simulation_id, 
                "simulation", 
                total_progress, 
                f"Time: {elapsed_time:.1f}s, Agents: {remaining_agents}/{total_expected}{flow_info}"
            )
       update_progress(simulation_id, "finalization", 90, "Calculating results...")
       
       end_time = time.time()
       final_agent_count = simulation.agent_count()
       
       if final_agent_count == 0:
           status = "completed"
           success = True
           message = "All agents successfully evacuated"
       elif simulation.elapsed_time() >= parameters.max_simulation_time:
           status = "timeout_time"
           success = False
           message = f"Simulation stopped at time limit ({parameters.max_simulation_time}s) with {final_agent_count} agents remaining"
       else:
           status = "timeout_iterations"
           success = False
           message = f"Simulation stopped at iteration limit with {final_agent_count} agents remaining"
       
       update_progress(simulation_id, "finalization", 95, "Extracting trajectory data...")
       
       trajectory_info = get_trajectory_info(output_file)
       geometry_wkt = get_geometry_wkt(output_file)
       
       update_progress(simulation_id, "completed", 100, "Simulation completed!")
       total_end_time = time.time()
       total_execution_time = total_end_time - total_start_time
       execution_time = end_time - start_time
       print("execution time:", execution_time)
       
       # DON'T delete the SQLite file yet - keep it for data extraction
       try:
           os.unlink(processed_json_path)
       except:
           pass
       
       # Calculate total agents including flow spawning
       total_agents_final = initial_agent_count
       if has_flow_spawning:
           total_agents_final += sum(agent_counter_per_source)
       
       metrics = {
           "simulation_id": simulation_id,
           "status": status,
           "execution_time": round(execution_time, 2),
           "evacuation_time": round(simulation.elapsed_time(), 2),
           "total_agents": total_agents_final,
           "agent_radii": agent_radii,
           "agents_evacuated": total_agents_final - final_agent_count,
           "agents_remaining": final_agent_count,
           "iterations_completed": simulation.iteration_count(),
           "success": success,
           "message": message,
           "max_simulation_time": parameters.max_simulation_time,
           "model_type": parameters.model_type
       }

       print("Metrics from run_simulation_with_visualization_progress:", metrics)
       
       results_storage[simulation_id] = {
           **metrics,
           "total_frames": trajectory_info["frame_count"],
           "geometry_wkt": geometry_wkt,
           "agent_radii": agent_radii,
           "sqlite_file": output_file if parameters.download_sqlite else None,
           "download_requested": parameters.download_sqlite
           }
       
       if not parameters.download_sqlite:
           # If not downloading, delete the SQLite file to save space
           try:
               os.unlink(output_file)
           except Exception as e:
               print(f"WARNING: Failed to delete SQLite file {output_file}: {e}")
           
       
       return metrics, geometry_wkt, agent_radii, output_file
   
   except Exception as e:
       end_time = time.time()
       execution_time = end_time - start_time
       
       print(f"ERROR in run_simulation_with_visualization_progress: {e}")
       import traceback
       traceback.print_exc()
       
       update_progress(simulation_id, "failed", 0, f"Simulation failed: {str(e)}")
       
       try:
           if 'output_file' in locals():
               os.unlink(output_file)
           if 'processed_json_path' in locals():
               os.unlink(processed_json_path)
       except:
           pass
       
       metrics = {
           "simulation_id": simulation_id,
           "status": "failed",
           "execution_time": round(execution_time, 2),
           "evacuation_time": 0.0,
           "total_agents": 0,
           "agent_radii": {},
           "agents_evacuated": 0,
           "agents_remaining": 0,
           "iterations_completed": 0,
           "success": False,
           "message": f"Simulation failed: {str(e)}",
           "max_simulation_time": parameters.max_simulation_time,
           "model_type": parameters.model_type
       }

       print("Metrics from run_simulation_with_visualization_progress (error):", metrics)
       
       return metrics, "", {}, ""
   



def run_multiple_simulations_with_progress(
    json_path: str, 
    walkable_area: pedpy.WalkableArea, 
    parameters: SimulationParameters,
    simulation_id: str
) -> tuple[Dict[str, Any], str, Dict[int, float], List[Dict[str, str]]]:
    """Run multiple simulations in parallel with different seeds"""
    
    all_sqlite_files = []
    primary_metrics = None
    primary_geometry_wkt = ""
    primary_agent_radii = {}
    
    total_simulations = parameters.number_of_simulations
    
    # Prepare arguments for parallel execution
    walkable_area_wkt = walkable_area.polygon.wkt  # Convert to WKT for serialization
    parameters_dict = parameters.dict()  # Convert to dict for serialization
    
    # Create temporary copies of the JSON file for each worker
    temp_json_files = []
    try:
        with open(json_path, 'r') as original_file:
            json_content = original_file.read()
        
        for i in range(total_simulations):
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            temp_file.write(json_content)
            temp_file.close()
            temp_json_files.append(temp_file.name)
        
        # Prepare worker arguments
        worker_args = []
        for i in range(total_simulations):
            current_seed = parameters.base_seed + i
            worker_args.append((
                temp_json_files[i],  # Each worker gets its own temp file
                walkable_area_wkt,
                parameters_dict,
                i,
                current_seed
            ))
        
        update_progress(simulation_id, "simulation", 0, f"Starting {total_simulations} parallel simulations...")
        
        # Run simulations in parallel using ProcessPoolExecutor
        max_workers = min(total_simulations, multiprocessing.cpu_count(), 8)
        completed_simulations = 0

        print(f"Running {total_simulations} simulations with {max_workers} parallel workers")

        
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            # Submit all jobs
            future_to_index = {
                executor.submit(run_single_simulation_worker, args): args[3] 
                for args in worker_args
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_index):
                completed_simulations += 1
                progress = (completed_simulations / total_simulations) * 100
                
                try:
                    result = future.result()
                    
                    if result["success"]:
                        # Store SQLite file info
                        all_sqlite_files.append({
                            "seed": result["seed"],
                            "file_path": result["output_file"],
                            "simulation_index": result["simulation_index"],
                            "metrics": result["metrics"]
                        })
                        
                        # Use first completed simulation as primary display
                        if primary_metrics is None:
                            primary_metrics = result["metrics"]
                            primary_geometry_wkt = result["geometry_wkt"]
                            primary_agent_radii = result["agent_radii"]
                        
                        update_progress(
                            simulation_id, 
                            "simulation", 
                            progress, 
                            f"Completed {completed_simulations}/{total_simulations} simulations (latest: seed {result['seed']})"
                        )
                    else:
                        print(f"Simulation failed for seed {result['seed']}: {result.get('error', 'Unknown error')}")
                        update_progress(
                            simulation_id, 
                            "simulation", 
                            progress, 
                            f"Completed {completed_simulations}/{total_simulations} simulations ({completed_simulations - len(all_sqlite_files)} failed)"
                        )
                        
                except Exception as e:
                    print(f"Error processing simulation result: {e}")
                    update_progress(
                        simulation_id, 
                        "simulation", 
                        progress, 
                        f"Completed {completed_simulations}/{total_simulations} simulations (some failed)"
                    )
        
        # Sort results by simulation index to maintain order
        all_sqlite_files.sort(key=lambda x: x["simulation_index"])
        
        update_progress(
            simulation_id, 
            "completed", 
            100, 
            f"Completed {len(all_sqlite_files)}/{total_simulations} simulations successfully"
        )
        
    finally:
        # Clean up temporary JSON files
        for temp_file in temp_json_files:
            try:
                os.unlink(temp_file)
            except:
                pass
    
    if not all_sqlite_files:
        raise Exception("All simulations failed")
    
    return primary_metrics, primary_geometry_wkt, primary_agent_radii, all_sqlite_files

def run_single_simulation_worker(args):
    """Worker function for running a single simulation in parallel"""
    json_path, walkable_area_wkt, parameters_dict, simulation_index, seed = args
    
    try:
        # Reconstruct objects from serializable data
        from shapely import wkt
        import pedpy
        
        geometry = wkt.loads(walkable_area_wkt)
        walkable_area = pedpy.WalkableArea(geometry)
        
        # Reconstruct parameters
        parameters = SimulationParameters(**parameters_dict)
        
        # Create unique simulation ID for this worker
        worker_sim_id = f"worker_{simulation_index}_{seed}"
        
        # Run the simulation
        metrics, geometry_wkt, agent_radii, output_file = run_simulation_with_visualization_progress(
            json_path, walkable_area, parameters, worker_sim_id, seed
        )
        
        return {
            "success": True,
            "seed": seed,
            "simulation_index": simulation_index,
            "metrics": metrics,
            "geometry_wkt": geometry_wkt,
            "agent_radii": agent_radii,
            "output_file": output_file
        }
        
    except Exception as e:
        print(f"Error in worker simulation {simulation_index} with seed {seed}: {e}")
        return {
            "success": False,
            "seed": seed,
            "simulation_index": simulation_index,
            "error": str(e),
            "output_file": None
        }
 