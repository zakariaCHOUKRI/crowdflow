from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class JourneyDefinition(BaseModel):
    id: str = Field(..., description="Unique journey identifier")
    name: str = Field(..., description="Human-readable journey name")
    color: str = Field(default="#3b82f6", description="Hex color code for visualization")
    waypoint_routing: Dict[str, List[JourneyRouting]] = Field(
        default_factory=dict, 
        description="Routing rules per waypoint for this journey"
    )

class DistributionJourneyAssignment(BaseModel):
    journey_id: str
    percentage: float = Field(..., ge=0, le=100)

class JourneyConfiguration(BaseModel):
    journeys: Dict[str, JourneyDefinition] = Field(default_factory=dict)
    distribution_assignments: Dict[str, List[DistributionJourneyAssignment]] = Field(
        default_factory=dict,
        description="Journey assignments per distribution"
    )