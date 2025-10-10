from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor
from middleware.performance_middleware import PerformanceMiddleware
from utils.performance_monitor import performance_monitor

from routes import simulation, journey, file_conversion

app = FastAPI(title="Pedestrian Simulation API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(PerformanceMiddleware)


# # Global dictionary to store progress for each simulation
# simulation_progress: Dict[str, Dict[str, Any]] = {}
# results_storage: Dict[str, Dict[str, Any]] = {}

# # Create thread pool for running simulations
# thread_pool = ThreadPoolExecutor(max_workers=4)

# Include routers
app.include_router(simulation.router)
app.include_router(journey.router)
app.include_router(file_conversion.router)


@app.on_event("startup")
async def startup_event():
    performance_monitor.start_monitoring(interval=2.0)

@app.on_event("shutdown")
async def shutdown_event():
    performance_monitor.stop_monitoring()

@app.get("/")
async def root():
    return {"message": "Pedestrian Simulation API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/models")
async def get_available_models():
    """Get list of available simulation models with updated parameters"""
    return {
        "models": [
            {
                "name": "CollisionFreeSpeedModel",
                "description": "Speed-based model with collision prevention through exponential repulsion.",
                "category": "Speed-based",
                "characteristics": [
                    "Fast computation",
                    "Global parameters", 
                    "Good for basic simulations"
                ],
                "parameters": [
                    {"name": "strength_neighbor_repulsion", "default": 2.6, "description": "Strength of repulsion from neighbors"},
                    {"name": "range_neighbor_repulsion", "default": 0.1, "description": "Range of neighbor influence"}
                ]
            },
            {
                "name": "CollisionFreeSpeedModelV2",
                "description": "Enhanced speed model with per-agent customizable repulsion parameters.",
                "category": "Speed-based (Advanced)",
                "characteristics": [
                    "Per-agent parameters",
                    "Individual behavior customization",
                    "More realistic diversity"
                ],
                "parameters": [
                    {"name": "strength_neighbor_repulsion", "default": 2.6, "description": "Per-agent neighbor repulsion strength"},
                    {"name": "range_neighbor_repulsion", "default": 0.1, "description": "Per-agent neighbor range"}
                ]
            },
            {
                "name": "GeneralizedCentrifugalForceModel", 
                "description": "Force-based model with elliptical agent representation.",
                "category": "Force-based",
                "characteristics": [
                    "Dynamic agent shape",
                    "Speed-dependent geometry",
                    "Realistic space requirements"
                ],
                "parameters": [
                    {"name": "mass", "default": 80.0, "description": "Agent mass in kg"},
                    {"name": "tau", "default": 0.5, "description": "Relaxation time"}
                ]
            },
            {
                "name": "SocialForceModel",
                "description": "Classic Helbing social force model for crowd dynamics.",
                "category": "Social Force",
                "characteristics": [
                    "Physically motivated",
                    "Social behavior modeling",
                    "Panic/emergency scenarios"
                ],
                "parameters": [
                    {"name": "relaxation_time", "default": 0.5, "description": "Acceleration relaxation time"},
                    {"name": "agent_strength", "default": 2000, "description": "Agent interaction strength"},
                    {"name": "agent_range", "default": 0.08, "description": "Agent interaction range"}
                ]
            },
            {
                "name": "AnticipationVelocityModel",
                "description": "Velocity-based model with anticipation of future movements.",
                "category": "Velocity-based",
                "characteristics": [
                    "Forward-looking behavior",
                    "Traffic flow inspired",
                    "Smooth movement patterns"
                ],
                "parameters": [
                    {"name": "T", "default": 1.0, "description": "Time headway parameter"},
                    {"name": "s0", "default": 0.5, "description": "Minimum spacing parameter"}
                ]
            }
        ],
        "recommendations": {
            "beginners": "CollisionFreeSpeedModel",
            "diverse_behavior": "CollisionFreeSpeedModelV2", 
            "realistic_movement": "GeneralizedCentrifugalForceModel",
            "emergency_evacuation": "SocialForceModel",
            "smooth_flow": "AnticipationVelocityModel"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)