from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
from utils.performance_monitor import performance_monitor

class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Record latency
        performance_monitor.record_latency(
            endpoint=f"{request.method} {request.url.path}",
            latency_ms=process_time
        )
        
        # Add header for debugging
        response.headers["X-Process-Time"] = str(process_time)
        
        return response