from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor

# Global objects that need to be shared across modules
simulation_progress: Dict[str, Dict[str, Any]] = {}
results_storage: Dict[str, Dict[str, Any]] = {}
thread_pool = ThreadPoolExecutor(max_workers=4)