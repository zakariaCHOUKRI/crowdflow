import React, { useState, useEffect } from 'react';
import './performance.css';

const PerformanceMonitor = () => {
    const [performanceData, setPerformanceData] = useState(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [plotImage, setPlotImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [endpointStats, setEndpointStats] = useState([]);

    const startMonitoring = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/performance/start-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                setIsMonitoring(true);
            }
        } catch (error) {
            console.error('Error starting monitoring:', error);
        }
    };

    const stopMonitoring = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/performance/stop-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                setIsMonitoring(false);
            }
        } catch (error) {
            console.error('Error stopping monitoring:', error);
        }
    };

    const generatePlot = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/performance/plot');
            const data = await response.json();
            console.log('Received data:', data); // Debug log
            console.log('Endpoint stats:', data.endpoint_stats); // Debug log
            
            setPlotImage(data.plot);
            setPerformanceData(data.summary);
            setEndpointStats(data.endpoint_stats || []);
        } catch (error) {
            console.error('Error generating plot:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearMetrics = async () => {
        try {
            await fetch('http://localhost:8000/api/performance/clear', { method: 'DELETE' });
            setPlotImage(null);
            setPerformanceData(null);
            setEndpointStats([]);
        } catch (error) {
            console.error('Error clearing metrics:', error);
        }
    };

    // Debug: Log when endpointStats changes
    useEffect(() => {
        console.log('EndpointStats updated:', endpointStats);
    }, [endpointStats]);

    return (
        <div className="performance-monitor">
            <div className="performance-header">
                <h2>Latency & Memory Profile</h2>
                <div className="performance-controls">
                    <button 
                        onClick={isMonitoring ? stopMonitoring : startMonitoring}
                        className={isMonitoring ? 'stop-btn' : 'start-btn'}
                    >
                        {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                    </button>
                    <button onClick={generatePlot} disabled={loading}>
                        {loading ? 'Generating...' : 'Generate Plot'}
                    </button>
                    <button onClick={clearMetrics}>Clear Metrics</button>
                </div>
            </div>

            {performanceData && (
                <div className="performance-summary">
                    <div className="metric-card">
                        <h3>Memory Stats</h3>
                        <p>Average: {performanceData.avg_memory_mb.toFixed(2)} MB</p>
                        <p>Peak: {performanceData.max_memory_mb.toFixed(2)} MB</p>
                    </div>
                    <div className="metric-card">
                        <h3>Latency Stats</h3>
                        <p>Average: {performanceData.avg_latency_ms.toFixed(2)} ms</p>
                        <p>Peak: {performanceData.max_latency_ms.toFixed(2)} ms</p>
                    </div>
                    <div className="metric-card">
                        <h3>Requests</h3>
                        <p>Total: {performanceData.total_requests}</p>
                    </div>
                </div>
            )}

            {endpointStats.length > 0 ? (
                <div className="endpoint-stats">
                    <h3>Endpoint Performance ({endpointStats.length} endpoints)</h3>
                    <div className="stats-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Method</th>
                                    <th>Action</th>
                                    <th>Mean Latency (ms)</th>
                                    <th>95th Percentile Latency (ms)</th>
                                    <th>Requests</th>
                                </tr>
                            </thead>
                            <tbody>
                                {endpointStats.map((stat, index) => {
                                    console.log('Rendering stat:', stat); // Debug log
                                    return (
                                        <tr key={index}>
                                            <td className="method-cell">
                                                <span className={`method-badge ${stat.method ? stat.method.toLowerCase() : 'unknown'}`}>
                                                    {stat.method || 'Unknown'}
                                                </span>
                                            </td>
                                            <td>{stat.action || 'Unknown'}</td>
                                            <td>{stat.mean_latency_ms || 0}</td>
                                            <td className={stat.percentile_95_ms > stat.mean_latency_ms * 2 ? 'high-variance' : 'low-variance'}>
                                                {stat.percentile_95_ms || 0}
                                            </td>
                                            <td>{stat.request_count || 0}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="endpoint-stats">
                    <h3>Endpoint Performance</h3>
                    <p>No endpoint data available. Make some API requests and generate the plot again.</p>
                </div>
            )}

            {plotImage && (
                <div className="performance-plot">
                    <img src={plotImage} alt="Performance Plot" />
                </div>
            )}

            <div className="monitoring-status">
                Status: <span className={isMonitoring ? 'monitoring' : 'stopped'}>
                    {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
                </span>
            </div>
        </div>
    );
};

export default PerformanceMonitor;