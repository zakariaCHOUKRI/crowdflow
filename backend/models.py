import sqlite3
from pydantic import BaseModel, Field
from typing import Dict, Any, Generator, List, Optional

class JourneyPathRequest(BaseModel):
    walkable_area_wkt: str
    journey_connections: List[Dict[str, Any]]
    elements: Dict[str, Any]

class JourneyPathResponse(BaseModel):
    journey_connections: List[Dict[str, Any]]
    success: bool
    errors: List[str] = []

class RouteDestination(BaseModel):
    target: str
    percentage: float = Field(ge=0, le=100)

class JourneyRouting(BaseModel):
    destinations: List[RouteDestination]

class SimulationParameters(BaseModel):
    max_simulation_time: float = Field(default=300.0, description="Maximum simulation time in seconds")
    model_type: str = Field(
        default="CollisionFreeSpeedModel", 
        description="Model type: 'CollisionFreeSpeedModel', 'CollisionFreeSpeedModelV2', 'GeneralizedCentrifugalForceModel', 'SocialForceModel', or 'AnticipationVelocityModel'"
    )

    download_sqlite: bool = Field(default=False, description="Whether to make SQLite file available for download")
    number_of_simulations: int = Field(default=1, ge=1, le=10, description="Number of simulations to run with different seeds")
    base_seed: int = Field(default=420, description="Base seed for simulation reproducibility")

    
    enable_flow_spawning: bool = Field(default=False, description="Enable flow-based agent spawning")

    
    # Collision Free Speed Model parameters (reduced)
    strength_neighbor_repulsion: float = Field(default=2.6, description="Strength of neighbor repulsion")
    range_neighbor_repulsion: float = Field(default=0.1, description="Range of neighbor repulsion")
    
    # Generalized Centrifugal Force Model parameters (reduced)
    mass: float = Field(default=80.0, description="Agent mass in kg")
    tau: float = Field(default=0.5, description="Relaxation time")
    
    # Social Force Model parameters (reduced)
    relaxation_time: float = Field(default=0.5, description="Acceleration relaxation time") 
    agent_strength: float = Field(default=2000, description="Agent interaction strength")
    agent_range: float = Field(default=0.08, description="Agent interaction range")
    
    # Anticipation Velocity Model parameters
    T: float = Field(default=1.0, description="Anticipation time parameter")
    s0: float = Field(default=0.3, description="Reaction time parameter")

    
    
class SimulationRequest(BaseModel):
    simulation_config: Dict[str, Any]
    walkable_area_wkt: str
    parameters: SimulationParameters = Field(default_factory=SimulationParameters)
    waypoint_routing: Dict[str, Any] = Field(default_factory=dict)


class AgentPosition(BaseModel):
    agent_id: int
    x: float
    y: float
    ori_x: float
    ori_y: float

class FrameData(BaseModel):
    frame: int
    agents: List[AgentPosition]

class SimulationResponse(BaseModel):
    simulation_id: str
    status: str
    execution_time: float
    evacuation_time: float
    total_agents: int
    agents_evacuated: int
    agents_remaining: int
    iterations_completed: int
    success: bool
    message: str
    max_simulation_time: float
    model_type: str


class SimulationVisualizationResponse(SimulationResponse):
    trajectory_data: Optional[List[FrameData]] = None
    total_frames: int = 0
    geometry_wkt: Optional[str] = None

class TrajectoryStreamer:
    def __init__(self, sqlite_file: str, chunk_size: int = 1000):
        self.sqlite_file = sqlite_file
        self.chunk_size = chunk_size
        self.conn = None
    
    def __enter__(self):
        self.conn = sqlite3.connect(self.sqlite_file)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.close()
    
    def get_frame_count(self) -> int:
        """Get total number of frames without loading data"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT frame) FROM trajectory_data")
        return cursor.fetchone()[0]
    
    def get_agent_count(self) -> int:
        """Get total number of unique agents"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT id) FROM trajectory_data")
        return cursor.fetchone()[0]
    
    def stream_frames(self, start_frame: int = 0, end_frame: Optional[int] = None) -> Generator[FrameData, None, None]:
        """Stream trajectory data frame by frame"""
        cursor = self.conn.cursor()
        
        if end_frame is None:
            end_frame = self.get_frame_count()
        
        for frame in range(start_frame, end_frame):
            cursor.execute("""
                SELECT id, pos_x, pos_y, ori_x, ori_y 
                FROM trajectory_data 
                WHERE frame = ?
                ORDER BY id
            """, (frame,))
            
            agents = []
            for agent_id, pos_x, pos_y, ori_x, ori_y in cursor.fetchall():
                agents.append(AgentPosition(
                    agent_id=agent_id,
                    x=pos_x,
                    y=pos_y,
                    ori_x=ori_x,
                    ori_y=ori_y
                ))
            
            if agents:  # Only yield frames with agents
                yield FrameData(frame=frame, agents=agents)

def getModelParameters(modelType):
    """Get the relevant parameters for each model type"""
    model_params = {
        'CollisionFreeSpeedModel': ['strength_neighbor_repulsion', 'range_neighbor_repulsion'],
        'CollisionFreeSpeedModelV2': ['strength_neighbor_repulsion', 'range_neighbor_repulsion'],
        'GeneralizedCentrifugalForceModel': ['mass', 'tau'],
        'SocialForceModel': ['relaxation_time', 'agent_strength', 'agent_range'],
        'AnticipationVelocityModel': ['T', 's0']
    }
    return model_params.get(modelType, [])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    has_geometry: bool
    wkt: Optional[str] = None
    json_config: Optional[Dict] = None