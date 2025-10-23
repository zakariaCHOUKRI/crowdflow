import json
import logging
import shutil
import tempfile
from pathlib import Path
import ezdxf
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

# Path to DXF conversion script
DXF2WKT_SCRIPT = "./dxfutils.py"  

class LogCapture:
    """Context manager to capture logging output"""
    def __init__(self, level=logging.ERROR):
        self.level = level
        self.logs = []
        self.handler = None
        
    def __enter__(self):
        # Create a custom handler that captures logs
        self.handler = logging.Handler()
        self.handler.setLevel(self.level)
        
        # Override emit to capture the log records
        def emit(record):
            self.logs.append({
                "level": record.levelname,
                "message": record.getMessage(),
                "logger": record.name,
                "timestamp": record.created
            })
        
        self.handler.emit = emit
        
        # Add handler to root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(self.handler)
        
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Remove the handler
        if self.handler:
            root_logger = logging.getLogger()
            root_logger.removeHandler(self.handler)
    
    def get_errors(self):
        """Get only error-level logs"""
        return [log for log in self.logs if log["level"] == "ERROR"]
    
    def get_warnings(self):
        """Get only warning-level logs"""
        return [log for log in self.logs if log["level"] == "WARNING"]
    
    def get_all_logs(self):
        """Get all captured logs"""
        return self.logs


@router.post("/convert-dxf")
async def convert_dxf(file: UploadFile = File(...)):
    """
    Convert uploaded DXF file to JSON and WKT formats
    """
    if not file.filename.lower().endswith('.dxf'):
        raise HTTPException(status_code=400, detail="File must be a DXF file")
    print("debug: Starting DXF conversion")  # DEBUG
    
    # Create temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            print("debug: Open dxf path")  # DEBUG
            # Save uploaded file
            dxf_path = Path(temp_dir) / file.filename
            with open(dxf_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Define output paths
            wkt_path = dxf_path.with_suffix('.wkt')
            json_path = dxf_path.with_suffix('.json')
            
            # Initialize response structure
            response = {
                "success": False,
                "wkt": "",
                "json": {},
                "summary": {},
                "layers_detected": {},
                "filename": file.filename,
                "errors": [],
                "warnings": []
            }
            
            # Call the convert function directly (no LogCapture needed)
            try:
                # Get auto-detected layers first
                doc = ezdxf.readfile(dxf_path)
                visible_layers = [
                    layer.dxf.name
                    for layer in doc.layers
                    if not layer.is_off() and not layer.is_frozen()
                ]
                
                # Auto-detect walkable layer
                walkable_matches = match_pattern(LAYER_PATTERNS["walkable"], visible_layers)
                walkable_layer = walkable_matches[0] if walkable_matches else None
                
                if not walkable_layer:
                    response["errors"].append({
                        "type": "layer_detection_error",
                        "message": "Could not auto-detect walkable area layer. Please ensure your DXF contains a layer with 'walkablearea' or 'jps-walkablearea' in the name.",
                        "details": f"Available layers: {visible_layers}",
                        "step": "Layer detection"
                    })
                    return response
                
                # Auto-detect other layers
                obstacle_layers = match_pattern(LAYER_PATTERNS["obstacles"], visible_layers)
                exit_layers = match_pattern(LAYER_PATTERNS["exits"], visible_layers)
                distribution_layers = match_pattern(LAYER_PATTERNS["distributions"], visible_layers)
                waypoint_layers = match_pattern(LAYER_PATTERNS["waypoints"], visible_layers)
                journey_layers = match_pattern(LAYER_PATTERNS["journeys"], visible_layers)
                
                # Call the modified parse_dxf_file function
                num_obstacles, geometry, parse_errors, parse_warnings = parse_dxf_file(
                    dxf_path,
                    walkable_layer,
                    obstacle_layers,
                    exit_layers,
                    distribution_layers,
                    waypoint_layers,
                    journey_layers,
                    quad_segs=4
                )
                
                # Add parse errors to response
                for error in parse_errors:
                    response["errors"].append({
                        "type": "dxf_parse_error",
                        "message": error,
                        "details": error,
                        "step": "DXF parsing"
                    })
                
                # Add parse warnings to response
                for warning in parse_warnings:
                    response["warnings"].append({
                        "type": "dxf_parse_warning",
                        "message": warning,
                        "details": warning,
                        "step": "DXF parsing"
                    })
                
                # If there were parse errors, consider this a failure
                if parse_errors:
                    response["success"] = False
                    return response
                
                # Save WKT file
                save_as_wkt(geometry, wkt_path)
                print("WKT conversion successful")  # DEBUG
                
            except Exception as e:
                print("DXF parsing failed")  # DEBUG
                error_msg = f"DXF parsing error: {str(e)}"
                response["errors"].append({
                    "type": "convert_error",
                    "message": error_msg,
                    "details": str(e),
                    "step": "DXF conversion"
                })
                return response
            
            # Call the make_journeys function
            try:
                journey_data = make_journeys(
                    input=dxf_path,
                    output=json_path
                )
                print("Journey creation successful")  # DEBUG
            except Exception as e:  
                error_msg = f"Journey creation error: {str(e)}"
                response["errors"].append({
                    "type": "journey_error",
                    "message": error_msg,
                    "details": str(e),
                    "step": "Journey creation"
                })
                return response
            
            # Read the generated files
            if not wkt_path.exists():
                response["errors"].append({
                    "type": "missing_file_error",
                    "message": "WKT file was not generated during conversion",
                    "details": f"Expected file: {wkt_path}",
                    "step": "File generation"
                })
                return response
                
            if not json_path.exists():
                response["errors"].append({
                    "type": "missing_file_error", 
                    "message": "JSON file was not generated during journey creation",
                    "details": f"Expected file: {json_path}",
                    "step": "File generation"
                })
                return response
            
            # Read WKT file
            try:
                with open(wkt_path, 'r', encoding='utf-8') as f:
                    wkt_content = f.read()
                response["wkt"] = wkt_content
            except Exception as e:
                response["errors"].append({
                    "type": "file_read_error",
                    "message": f"Error reading WKT file: {str(e)}",
                    "details": str(e),
                    "step": "File reading"
                })
                return response
            
            # Read JSON file
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_content = json.load(f)
                response["json"] = json_content
            except Exception as e:
                response["errors"].append({
                    "type": "file_read_error",
                    "message": f"Error reading JSON file: {str(e)}",
                    "details": str(e),
                    "step": "File reading"
                })
                return response
            
            # Create summary
            try:
                response["summary"] = create_summary_from_data(wkt_content, json_content)
            except Exception as e:
                response["errors"].append({
                    "type": "summary_error",
                    "message": f"Error creating summary: {str(e)}",
                    "details": str(e),
                    "step": "Summary creation"
                })
                return response
            
            # Extract layers
            try:
                response["layers_detected"] = extract_layers_from_data(json_content)
            except Exception as e:
                response["errors"].append({
                    "type": "layer_extraction_error",
                    "message": f"Error extracting layers: {str(e)}",
                    "details": str(e),
                    "step": "Layer extraction"
                })
                return response
            
            # If we reach here, everything succeeded
            response["success"] = True
            return response
            
        except HTTPException:
            raise  # Re-raise HTTPExceptions as-is
        except Exception as e:
            # Catch-all for unexpected errors
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "wkt": "",
                    "json": {},
                    "summary": {},
                    "layers_detected": {},
                    "filename": file.filename,
                    "errors": [{
                        "type": "unexpected_error",
                        "message": f"Unexpected error during conversion: {str(e)}",
                        "details": str(e),
                        "step": "Unexpected"
                    }],
                    "warnings": []
                }
            )