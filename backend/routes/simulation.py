import asyncio
import io
import json
import os
import tempfile
import time
import uuid
from fastapi import APIRouter, HTTPException
from typing import AsyncGenerator, Optional

from fastapi.responses import StreamingResponse
import pedpy
from utils.data_processing import _convert_waypoint_routing_to_dict, get_trajectory_info
from utils.validation import _validate_waypoint_routing
from models import SimulationRequest, TrajectoryStreamer
from services.simulation_service import run_multiple_simulations_with_progress, run_simulation_with_visualization_progress, update_progress
from shapely import wkt
from utils.dependencies import simulation_progress, results_storage, thread_pool


router = APIRouter()

@router.post("/simulate_with_visualization_start")
async def simulate_with_visualization_start(request: SimulationRequest):
    """Start simulation and return simulation ID for progress tracking"""
    

    try:
   
        # Validate WKT geometry with better error messages
        if not request.walkable_area_wkt or request.walkable_area_wkt.strip() == "":
            raise HTTPException(status_code=400, detail="walkable_area_wkt is required and cannot be empty")
                
        try:
            geometry = wkt.loads(request.walkable_area_wkt)
            
            if hasattr(geometry, 'geoms'):
                if len(geometry.geoms) == 0:
                    raise HTTPException(status_code=400, detail="WKT geometry collection is empty")
                walkable_area = pedpy.WalkableArea(geometry.geoms[0])
            else:
                walkable_area = pedpy.WalkableArea(geometry)
                
        except Exception as wkt_error:
            print(f"ERROR: WKT parsing failed: {wkt_error}")
            raise HTTPException(status_code=400, detail=f"Invalid WKT geometry: {str(wkt_error)}")
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"ERROR: Unexpected error in WKT processing: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing walkable area: {str(e)}")

    try:
        # Validate simulation_config
        if not request.simulation_config:
            raise HTTPException(status_code=400, detail="simulation_config is required")
        
  
        # Validate model type with detailed error
        valid_models = [
            "CollisionFreeSpeedModel", 
            "CollisionFreeSpeedModelV2", 
            "GeneralizedCentrifugalForceModel", 
            "SocialForceModel",
            "AnticipationVelocityModel"
        ]
        
        if not request.parameters:
            raise HTTPException(status_code=400, detail="parameters object is required")
            
        if not request.parameters.model_type:
            raise HTTPException(status_code=400, detail="model_type is required in parameters")
            
        if request.parameters.model_type not in valid_models:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid model type: '{request.parameters.model_type}'. Supported types: {', '.join(valid_models)}"
            )
        
        
        # NEW: ONLY require exits, make distributions optional
        if "exits" not in request.simulation_config:
            raise HTTPException(
                status_code=400,
                detail="simulation_config must contain 'exits' key - at least one exit is required"
            )
        
        exits = request.simulation_config["exits"]
        if not isinstance(exits, dict):
            raise HTTPException(
                status_code=400,
                detail=f"'exits' must be a dictionary, got {type(exits)}"
            )
        
        if len(exits) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one exit is required for simulation"
            )
        
        
        # Validate each exit
        for exit_id, exit_data in exits.items():
            
            if not isinstance(exit_data, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"Exit '{exit_id}' must be a dictionary, got {type(exit_data)}"
                )
            
            if "coordinates" not in exit_data:
                raise HTTPException(
                    status_code=400,
                    detail=f"Exit '{exit_id}' is missing 'coordinates' key"
                )
            
            coords = exit_data["coordinates"]
            if not isinstance(coords, list):
                raise HTTPException(
                    status_code=400,
                    detail=f"Exit '{exit_id}' coordinates must be a list"
                )
            
            if len(coords) < 3:
                raise HTTPException(
                    status_code=400,
                    detail=f"Exit '{exit_id}' must have at least 3 coordinate points"
                )
            
            for i, coord in enumerate(coords):
                if not isinstance(coord, list) or len(coord) != 2:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Exit '{exit_id}' coordinate {i} must be [x, y] format"
                    )
                
                if not all(isinstance(c, (int, float)) for c in coord):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Exit '{exit_id}' coordinate {i} must contain numbers"
                    )
                    
        if "distributions" in request.simulation_config:
            distributions = request.simulation_config["distributions"]
            
            if isinstance(distributions, dict) and len(distributions) > 0:
                
                # Validate each distribution with detailed error reporting
                for dist_id, distribution in distributions.items():
                    
                    if not isinstance(distribution, dict):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Distribution '{dist_id}' must be a dictionary, got {type(distribution)}"
                        )
                    
                    if "parameters" in distribution:
                        parameters = distribution["parameters"]
                        if isinstance(parameters, dict) and "number" in parameters:
                            agent_count = parameters["number"]
                            if not isinstance(agent_count, (int, float)):
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Distribution '{dist_id}' 'number' must be a number, got {type(agent_count)}"
                                )
                            
                            if agent_count <= 0:
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Distribution '{dist_id}' agent count must be > 0, got {agent_count}"
                                )
                    
                    # Validate coordinates if present
                    if "coordinates" in distribution:
                        coords = distribution["coordinates"]
                        if not isinstance(coords, list):
                            raise HTTPException(
                                status_code=400,
                                detail=f"Distribution '{dist_id}' coordinates must be a list"
                            )
                        
                        if len(coords) < 3:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Distribution '{dist_id}' must have at least 3 coordinate points"
                            )
                        
                        for i, coord in enumerate(coords):
                            if not isinstance(coord, list) or len(coord) != 2:
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Distribution '{dist_id}' coordinate {i} must be [x, y] format"
                                )
                            
                            if not all(isinstance(c, (int, float)) for c in coord):
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Distribution '{dist_id}' coordinate {i} must contain numbers"
                                )
                    
            
        try:
            if request.waypoint_routing:
                _validate_waypoint_routing(request.waypoint_routing, request.simulation_config)
                
                # Convert to dict and add to simulation config
                waypoint_routing_dict = _convert_waypoint_routing_to_dict(request.waypoint_routing)
                request.simulation_config["waypoint_routing"] = waypoint_routing_dict
        
        except Exception as routing_error:
            raise HTTPException(status_code=400, detail=f"Waypoint routing validation error: {str(routing_error)}")
        
        # Generate simulation ID
        simulation_id = str(uuid.uuid4())
        
        # Save JSON config to temporary file with error handling
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(request.simulation_config, temp_file, indent=2)
                temp_json_path = temp_file.name
        except Exception as file_error:
            print(f"ERROR: Failed to save config file: {file_error}")
            raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(file_error)}")
        
        if request.parameters.enable_flow_spawning:
            print("DEBUG: Flow spawning enabled globally")
            
            # Validate that distributions with flow spawning have valid parameters
            if "distributions" in request.simulation_config:
                for dist_id, dist_data in request.simulation_config["distributions"].items():
                    params = dist_data.get("parameters", {})
                    if isinstance(params, dict) and params.get("use_flow_spawning", False):
                        start_time = params.get("flow_start_time", 0)
                        end_time = params.get("flow_end_time", 10)
                        
                        if end_time <= start_time:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Distribution '{dist_id}' flow_end_time must be greater than flow_start_time"
                            )
                        
                        print(f"DEBUG: Distribution {dist_id} has flow spawning: {start_time}s to {end_time}s")
        
        # Initialize progress
        update_progress(simulation_id, "queued", 0, "Simulation queued...")
        
        # Start simulation in background thread
        def run_simulation():
            try:
                
                if request.parameters.number_of_simulations > 1:
                    # Run multiple simulations
                    metrics, geometry_wkt, agent_radii, all_sqlite_files = run_multiple_simulations_with_progress(
                        temp_json_path, walkable_area, request.parameters, simulation_id
                    )
                else:
                    # Run single simulation (existing logic) - FIX: Make sure this returns 4 values
                    metrics, geometry_wkt, agent_radii, output_file = run_simulation_with_visualization_progress(
                        temp_json_path, walkable_area, request.parameters, simulation_id, request.parameters.base_seed
                    )
                    all_sqlite_files = [{
                        "seed": request.parameters.base_seed,
                        "file_path": output_file,
                        "simulation_index": 0,
                        "metrics": metrics
                    }]
                
                
                # Get trajectory info from the primary (first) simulation
                primary_sqlite_file = all_sqlite_files[0]["file_path"] if all_sqlite_files else None
                trajectory_info = get_trajectory_info(primary_sqlite_file) if primary_sqlite_file else {"frame_count": 0}
                
                # Store results with both old and new structure for compatibility
                results_storage[simulation_id] = {
                    **metrics,
                    "total_frames": trajectory_info["frame_count"],
                    "geometry_wkt": geometry_wkt,
                    "agent_radii": agent_radii,
                    # For backwards compatibility with single simulation
                    "sqlite_file": primary_sqlite_file,
                    # For multiple simulations
                    "sqlite_files": all_sqlite_files if request.parameters.download_sqlite else [],
                    "download_requested": request.parameters.download_sqlite,
                    "primary_sqlite_file": primary_sqlite_file,
                    "number_of_simulations": request.parameters.number_of_simulations
                }
                
                # Clean up files if not needed for download
                if not request.parameters.download_sqlite:
                    for sqlite_info in all_sqlite_files:
                        try:
                            os.unlink(sqlite_info["file_path"])
                        except:
                            pass
                
                simulation_progress[simulation_id].update({
                    "completed": True,
                    "basic_metrics": metrics
                })
                
            except Exception as sim_error:
                print(f"ERROR: Simulation failed for {simulation_id}: {sim_error}")
                import traceback
                traceback.print_exc()
                update_progress(simulation_id, "failed", 0, f"Simulation failed: {str(sim_error)}")
            finally:
                # Cleanup
                try:
                    os.unlink(temp_json_path)
                except Exception as cleanup_error:
                    print(f"WARNING: Failed to cleanup temp file: {cleanup_error}")
        
        # Submit to thread pool
        try:
            thread_pool.submit(run_simulation)
        except Exception as thread_error:
            print(f"ERROR: Failed to submit to thread pool: {thread_error}")
            # Cleanup temp file
            try:
                os.unlink(temp_json_path)
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Failed to start simulation: {str(thread_error)}")
        
        return {"simulation_id": simulation_id, "message": "Simulation started"}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"ERROR: Unexpected error in simulation setup: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


@router.get("/simulation_progress/{simulation_id}")
async def get_simulation_progress(simulation_id: str):
    """Get progress for a specific simulation"""
    if simulation_id not in simulation_progress:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    progress_data = simulation_progress[simulation_id].copy()
    
    # Clean up old completed simulations (optional)
    if progress_data.get("stage") in ["completed", "failed"]:
        # Keep results for 5 minutes after completion
        if time.time() - progress_data.get("timestamp", 0) > 300:
            # Clean up both progress and results storage
            del simulation_progress[simulation_id]
            if simulation_id in results_storage:
                result_data = results_storage[simulation_id]
                # Clean up all SQLite files if they exist
                if "sqlite_files" in result_data:
                    for file_info in result_data["sqlite_files"]:
                        try:
                            if os.path.exists(file_info["file_path"]):
                                os.unlink(file_info["file_path"])
                        except Exception as e:
                            print(f"Error deleting sqlite file {file_info['file_path']}: {e}")
                
                # Also handle the single file case for backward compatibility
                elif "sqlite_file" in result_data and result_data["sqlite_file"]:
                    try:
                        if os.path.exists(result_data["sqlite_file"]):
                            os.unlink(result_data["sqlite_file"])
                    except Exception as e:
                        print(f"Error deleting sqlite file {result_data['sqlite_file']}: {e}")

                del results_storage[simulation_id]
    
    return progress_data

@router.get("/simulation_results/{simulation_id}")
async def get_simulation_results(simulation_id: str):
    """Get basic simulation results without trajectory data"""
    
    if simulation_id not in simulation_progress:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    progress_data = simulation_progress[simulation_id]
    
    if progress_data.get("stage") != "completed":
        raise HTTPException(status_code=400, detail="Simulation not completed yet")
    
    if simulation_id not in results_storage:
        raise HTTPException(status_code=500, detail="Results not available")
    
    results = results_storage[simulation_id].copy()
    
    # Check for trajectory data - support both old and new structure
    sqlite_file = results.get("sqlite_file") or results.get("primary_sqlite_file")
    has_trajectory_data = sqlite_file is not None and os.path.exists(sqlite_file)
    
    # Check for download availability
    sqlite_files = results.get("sqlite_files", [])
    download_requested = results.get("download_requested", False)
    sqlite_download_available = download_requested and len(sqlite_files) > 0 and any(
        os.path.exists(f["file_path"]) for f in sqlite_files
    )
    
    # Create lightweight response
    lightweight_results = {
        "simulation_id": results["simulation_id"],
        "status": results["status"],
        "execution_time": results["execution_time"],
        "evacuation_time": results["evacuation_time"],
        "total_agents": results["total_agents"],
        "agent_radii": results["agent_radii"],
        "agents_evacuated": results["agents_evacuated"],
        "agents_remaining": results["agents_remaining"],
        "iterations_completed": results["iterations_completed"],
        "success": results["success"],
        "message": results["message"],
        "max_simulation_time": results["max_simulation_time"],
        "model_type": results["model_type"],
        "total_frames": results.get("total_frames", 0),
        "geometry_wkt": results.get("geometry_wkt", ""),
        "has_trajectory_data": has_trajectory_data,
        "sqlite_download_available": sqlite_download_available,
        "primary_sqlite_file": sqlite_file,
        "number_of_simulations": results.get("number_of_simulations", 1)
    }
    print(" lightweight results from get_simulation_results:", lightweight_results)

    return lightweight_results

@router.get("/simulation_trajectory/{simulation_id}")
async def get_simulation_trajectory(
    simulation_id: str,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
    chunk_size: int = 100
):
    """Get trajectory data in chunks to avoid memory issues"""
    
    if simulation_id not in results_storage:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    result_data = results_storage[simulation_id]
    
    # Support both old and new structure
    sqlite_file = result_data.get("sqlite_file") or result_data.get("primary_sqlite_file")
    
    if not sqlite_file:
        raise HTTPException(status_code=404, detail="Trajectory data not available - no SQLite file")
    
    if not os.path.exists(sqlite_file):
        raise HTTPException(status_code=404, detail="Trajectory data not available - SQLite file not found")
    
    try:
        with TrajectoryStreamer(sqlite_file) as streamer:
            total_frames = streamer.get_frame_count()
            
            if end_frame is None:
                end_frame = total_frames
            
            # Limit chunk size to prevent memory issues
            actual_end = min(start_frame + chunk_size, end_frame, total_frames)
            
            frames = []
            for frame_data in streamer.stream_frames(start_frame, actual_end):
                frames.append(frame_data)
            
            return {
                "frames": frames,
                "start_frame": start_frame,
                "end_frame": actual_end,
                "total_frames": total_frames,
                "has_more": actual_end < total_frames,
                "next_start_frame": actual_end if actual_end < total_frames else None
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading trajectory: {str(e)}")

@router.get("/simulation_sqlite/{simulation_id}")
async def download_simulation_sqlite(simulation_id: str, seed: Optional[int] = None):
    """Download SQLite trajectory file(s) and remove from server"""
    
    if simulation_id not in results_storage:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    result_data = results_storage[simulation_id]
    
    sqlite_files = result_data.get("sqlite_files", [])
    
    if not sqlite_files:
        raise HTTPException(status_code=404, detail="SQLite files not available")
    
    if seed is not None:
        # Download specific seed
        sqlite_info = next((f for f in sqlite_files if f["seed"] == seed), None)
        if not sqlite_info:
            raise HTTPException(status_code=404, detail=f"SQLite file for seed {seed} not found")
        
        sqlite_file = sqlite_info["file_path"]
        if not os.path.exists(sqlite_file):
            raise HTTPException(status_code=404, detail="SQLite file no longer exists")
        
        try:
            with open(sqlite_file, 'rb') as f:
                file_content = f.read()
            
            # Remove this specific file
            # os.unlink(sqlite_file)
            
            # Remove from sqlite_files list
            result_data["sqlite_files"] = [f for f in sqlite_files if f["seed"] != seed]
            
            return StreamingResponse(
                io.BytesIO(file_content),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename=simulation_seed_{seed}.sqlite"
                }
            )
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")
    
    else:
        # Download all as ZIP
        import zipfile
        
        try:
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for sqlite_info in sqlite_files:
                    sqlite_file = sqlite_info["file_path"]
                    if os.path.exists(sqlite_file):
                        zip_file.write(sqlite_file, f"simulation_seed_{sqlite_info['seed']}.sqlite")
            
            # Clean up all files after creating ZIP
            for sqlite_info in sqlite_files:
                try:
                    os.unlink(sqlite_info["file_path"])
                except:
                    pass
            
            # Clear sqlite_files from storage
            result_data["sqlite_files"] = []
            
            zip_buffer.seek(0)
            
            return StreamingResponse(
                io.BytesIO(zip_buffer.read()),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename=simulation_{simulation_id}_all_seeds.zip"
                }
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating ZIP file: {str(e)}")
    

@router.get("/simulation_seeds/{simulation_id}")
async def get_simulation_seeds(simulation_id: str):
    """Get list of available seeds for download"""
    
    if simulation_id not in results_storage:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    result_data = results_storage[simulation_id]
    sqlite_files = result_data.get("sqlite_files", [])
    
    return {
        "seeds": [
            {
                "seed": f["seed"],
                "simulation_index": f["simulation_index"],
                "available": os.path.exists(f["file_path"])
            }
            for f in sqlite_files
        ]
    }

@router.get("/simulation_stream/{simulation_id}")
async def stream_simulation_progress(simulation_id: str):
    """Stream simulation progress via Server-Sent Events with improved connection handling"""
    
    async def event_generator() -> AsyncGenerator[str, None]:
        last_timestamp = 0
        retry_count = 0
        max_retries = 3
        
        # Send initial connection message
        yield f"data: {json.dumps({'stage': 'connected', 'progress': 0, 'message': 'Connected to simulation stream'})}\n\n"
        
        while True:
            try:
                if simulation_id not in simulation_progress:
                    if retry_count < max_retries:
                        retry_count += 1
                        await asyncio.sleep(1)  # Wait a bit longer for simulation to start
                        continue
                    else:
                        yield f"data: {json.dumps({'error': 'Simulation not found'})}\n\n"
                        break
                
                progress_data = simulation_progress[simulation_id]
                current_timestamp = progress_data.get("timestamp", 0)
                
                # Send heartbeat every 10 seconds to keep connection alive
                if current_timestamp == last_timestamp:
                    yield f": heartbeat\n\n"
                
                # Only send update if there's new data
                if current_timestamp > last_timestamp:
                    # Create a clean version without complex objects
                    clean_progress_data = {
                        "stage": progress_data.get("stage"),
                        "progress": progress_data.get("progress", 0),
                        "message": progress_data.get("message", ""),
                        "timestamp": progress_data.get("timestamp", 0)
                    }
                    
                    yield f"data: {json.dumps(clean_progress_data)}\n\n"
                    last_timestamp = current_timestamp
                    retry_count = 0  # Reset retry count on successful update
                
                # Check if simulation is completed or failed
                if progress_data.get("stage") in ["completed", "failed"]:
                    # Send final message and close gracefully
                    yield f"data: {json.dumps({'stage': 'closing', 'message': 'Stream closing normally'})}\n\n"
                    break
                
                # Wait before checking again
                await asyncio.sleep(0.5)  # Check every 500ms
                
            except Exception as e:
                print(f"Error in SSE stream: {e}")
                yield f"data: {json.dumps({'error': f'Stream error: {str(e)}'})}\n\n"
                break
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        }
    )
