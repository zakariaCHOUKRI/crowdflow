import time
import psutil
import threading
from typing import Dict, List, Tuple
from datetime import datetime
import json

class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'latency': [],
            'memory': [],
            'timestamps': []
        }
        self.is_monitoring = False
        self.monitor_thread = None
        
    def start_monitoring(self, interval: float = 1.0):
        """Start monitoring performance metrics"""
        if self.is_monitoring:
            return
            
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,)
        )
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop monitoring performance metrics"""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()
    
    def _monitor_loop(self, interval: float):
        """Main monitoring loop"""
        while self.is_monitoring:
            timestamp = datetime.now().isoformat()
            memory_mb = psutil.virtual_memory().used / (1024 * 1024)
            
            self.metrics['timestamps'].append(timestamp)
            self.metrics['memory'].append(memory_mb)
            
            time.sleep(interval)
    
    def record_latency(self, endpoint: str, latency_ms: float):
        """Record latency for specific endpoint"""
        self.metrics['latency'].append({
            'endpoint': endpoint,
            'latency_ms': latency_ms,
            'timestamp': datetime.now().isoformat()
        })
    
    def get_metrics(self) -> Dict:
        """Get current metrics"""
        return self.metrics.copy()
    
    def clear_metrics(self):
        """Clear all metrics"""
        self.metrics = {
            'latency': [],
            'memory': [],
            'timestamps': []
        }

# Global monitor instance
performance_monitor = PerformanceMonitor()