import sqlite3
from typing import Dict, List

from models import AgentPosition, FrameData, JourneyRouting


def extract_trajectory_data(sqlite_file: str) -> tuple[List[FrameData], str]:
    """Extract trajectory data from SQLite file"""
    trajectory_data = []
    geometry_wkt = ""
    
    try:
        conn = sqlite3.connect(sqlite_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT wkt FROM geometry LIMIT 1")
        geometry_result = cursor.fetchone()
        if geometry_result:
            geometry_wkt = geometry_result[0]
        
        cursor.execute("""
            SELECT frame, id, pos_x, pos_y, ori_x, ori_y 
            FROM trajectory_data 
            ORDER BY frame, id
        """)
        rows = cursor.fetchall()
        
        frames = {}
        for frame, agent_id, pos_x, pos_y, ori_x, ori_y in rows:
            if frame not in frames:
                frames[frame] = []
            frames[frame].append(AgentPosition(
                agent_id=agent_id,
                x=pos_x,
                y=pos_y,
                ori_x=ori_x,
                ori_y=ori_y
            ))
        
        trajectory_data = [
            FrameData(frame=frame, agents=agents)
            for frame, agents in sorted(frames.items())
        ]
        
        conn.close()
        
    except Exception as e:
        print(f"Error extracting trajectory data: {e}")
        trajectory_data = []
        geometry_wkt = ""
    
    return trajectory_data, geometry_wkt

def get_trajectory_info(sqlite_file: str) -> Dict[str, int]:
    """Get basic trajectory info without loading all data"""
    try:
        conn = sqlite3.connect(sqlite_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(DISTINCT frame) FROM trajectory_data")
        frame_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT id) FROM trajectory_data")
        agent_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM trajectory_data")
        total_points = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "frame_count": frame_count,
            "agent_count": agent_count,
            "total_points": total_points
        }
    except Exception as e:
        print(f"Error getting trajectory info: {e}")
        return {"frame_count": 0, "agent_count": 0, "total_points": 0}

def get_geometry_wkt(sqlite_file: str) -> str:
    """Get geometry WKT without loading trajectory data"""
    try:
        conn = sqlite3.connect(sqlite_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT wkt FROM geometry LIMIT 1")
        result = cursor.fetchone()
        
        conn.close()
        
        return result[0] if result else ""
    except Exception as e:
        print(f"Error getting geometry: {e}")
        return ""

def _convert_waypoint_routing_to_dict(waypoint_routing: Dict[str, Dict[str, JourneyRouting]]) -> Dict:
    """Convert Pydantic models to dict for JSON serialization"""
    result = {}
    for waypoint_id, journey_routing in waypoint_routing.items():
        result[waypoint_id] = {}
        for journey_id, routing_config in journey_routing.items():
            result[waypoint_id][journey_id] = {
                "destinations": [
                    {
                        "target": dest.target if hasattr(dest, 'target') else dest["target"],
                        "percentage": dest.percentage if hasattr(dest, 'percentage') else dest["percentage"]
                    }
                    for dest in (routing_config.destinations if hasattr(routing_config, 'destinations') else routing_config.get("destinations", []))
                ]
            }
    return result
