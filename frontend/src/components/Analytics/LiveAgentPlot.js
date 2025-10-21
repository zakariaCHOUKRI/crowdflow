import React, { useEffect, useRef, useState, useMemo } from 'react';

const LiveAgentPlot = ({ 
  trajectoryData, 
  currentFrame, 
  simulationResults, 
  isVisible = true 
}) => {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 200 });

  
  const agentCountData = useMemo(() => {
    if (!trajectoryData || trajectoryData.length === 0) return [];
    
    return trajectoryData.map((frame, index) => ({
      frame: index,
      time: (index / trajectoryData.length) * (simulationResults?.max_simulation_time || 300),
      agentCount: frame.agents.length,
      totalAgents: simulationResults?.total_agents || 0
    }));
  }, [trajectoryData, simulationResults]);

  
  const theme = {
    background: 'rgba(15, 23, 42, 0.95)',
    border: 'rgba(51, 65, 85, 0.6)',
    grid: 'rgba(71, 85, 105, 0.3)',
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    accent: '#3b82f6',
    accentGlow: 'rgba(59, 130, 246, 0.4)',
    activeLine: '#10b981',
    activeGlow: 'rgba(16, 185, 129, 0.6)',
    futureData: 'rgba(100, 116, 139, 0.4)',
    currentIndicator: '#f59e0b'
  };

  
  const drawPlot = () => {
    const canvas = canvasRef.current;
    if (!canvas || agentCountData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    
    ctx.clearRect(0, 0, width, height);
    
    
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, theme.background);
    bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    
    const maxTime = Math.max(...agentCountData.map(d => d.time));
    const maxAgents = Math.max(...agentCountData.map(d => d.agentCount));
    const minAgents = Math.min(...agentCountData.map(d => d.agentCount));
    
    
    const xScale = (time) => margin.left + (time / maxTime) * plotWidth;
    const yScale = (count) => margin.top + plotHeight - ((count - minAgents) / (maxAgents - minAgents)) * plotHeight;
    
    
    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.shadowColor = 'rgba(71, 85, 105, 0.5)';
    ctx.shadowBlur = 1;
    
    
    const timeSteps = 4;
    for (let i = 1; i < timeSteps; i++) {
      const time = (maxTime / timeSteps) * i;
      const x = xScale(time);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, height - margin.bottom);
      ctx.stroke();
    }
    
    
    const countSteps = 3;
    for (let i = 1; i < countSteps; i++) {
      const count = minAgents + ((maxAgents - minAgents) / countSteps) * i;
      const y = yScale(count);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
    }
    ctx.restore();

    
    ctx.save();
    const axisGradient = ctx.createLinearGradient(margin.left, margin.top, width - margin.right, height - margin.bottom);
    axisGradient.addColorStop(0, 'rgba(148, 163, 184, 0.8)');
    axisGradient.addColorStop(1, 'rgba(71, 85, 105, 0.6)');
    
    ctx.strokeStyle = axisGradient;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.shadowColor = 'rgba(148, 163, 184, 0.3)';
    ctx.shadowBlur = 2;
    
    ctx.beginPath();
    
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();
    ctx.restore();

    
    const drawSmoothCurve = (points, strokeStyle, lineWidth, shadowBlur = 0, shadowColor = null) => {
      if (points.length < 2) return;
      
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shadowBlur > 0 && shadowColor) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
      }
      
      ctx.beginPath();
      const firstPoint = points[0];
      ctx.moveTo(xScale(firstPoint.time), yScale(firstPoint.agentCount));
      
      
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const currentX = xScale(current.time);
        const currentY = yScale(current.agentCount);
        const nextX = xScale(next.time);
        const nextY = yScale(next.agentCount);
        
        
        const controlX = currentX + (nextX - currentX) * 0.5;
        const controlY = currentY;
        
        ctx.quadraticCurveTo(controlX, controlY, (currentX + nextX) * 0.5, (currentY + nextY) * 0.5);
      }
      
      
      if (points.length > 1) {
        const lastPoint = points[points.length - 1];
        ctx.lineTo(xScale(lastPoint.time), yScale(lastPoint.agentCount));
      }
      
      ctx.stroke();
      ctx.restore();
    };

    
    if (agentCountData.length > 1) {
      const pastData = agentCountData.slice(0, currentFrame + 1);
      if (pastData.length > 1) {
        ctx.save();
        
        
        const fillGradient = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        fillGradient.addColorStop(0.7, 'rgba(59, 130, 246, 0.15)');
        fillGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        
        
        const firstPoint = pastData[0];
        ctx.moveTo(xScale(firstPoint.time), height - margin.bottom);
        ctx.lineTo(xScale(firstPoint.time), yScale(firstPoint.agentCount));
        
        
        for (let i = 1; i < pastData.length - 1; i++) {
          const current = pastData[i];
          const next = pastData[i + 1];
          const currentX = xScale(current.time);
          const currentY = yScale(current.agentCount);
          const nextX = xScale(next.time);
          const nextY = yScale(next.agentCount);
          
          const controlX = currentX + (nextX - currentX) * 0.5;
          const controlY = currentY;
          
          ctx.quadraticCurveTo(controlX, controlY, (currentX + nextX) * 0.5, (currentY + nextY) * 0.5);
        }
        
        if (pastData.length > 1) {
          const lastPoint = pastData[pastData.length - 1];
          ctx.lineTo(xScale(lastPoint.time), yScale(lastPoint.agentCount));
          ctx.lineTo(xScale(lastPoint.time), height - margin.bottom);
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    
    if (agentCountData.length > 1) {
      
      const pastData = agentCountData.slice(0, currentFrame + 1);
      if (pastData.length > 1) {
        
        const lineGradient = ctx.createLinearGradient(
          xScale(pastData[0].time), 0, 
          xScale(pastData[pastData.length - 1].time), 0
        );
        lineGradient.addColorStop(0, '#10b981');
        lineGradient.addColorStop(0.6, '#3b82f6');
        lineGradient.addColorStop(1, '#8b5cf6');
        
        drawSmoothCurve(pastData, lineGradient, 4, 8, 'rgba(16, 185, 129, 0.4)');
        
        
        drawSmoothCurve(pastData, '#ffffff', 1.5);
      }
      
      
      const futureData = agentCountData.slice(currentFrame);
      if (futureData.length > 1) {
        ctx.save();
        ctx.setLineDash([8, 12]);
        drawSmoothCurve(futureData, 'rgba(100, 116, 139, 0.4)', 2);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    
    if (currentFrame < agentCountData.length) {
      const currentPoint = agentCountData[currentFrame];
      const x = xScale(currentPoint.time);
      const y = yScale(currentPoint.agentCount);
      
      ctx.save();
      
      
      const pulseRadius = 12 + Math.sin(Date.now() * 0.005) * 3;
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, pulseRadius);
      glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
      glowGradient.addColorStop(0.7, 'rgba(59, 130, 246, 0.2)');
      glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      
      const dotGradient = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 8);
      dotGradient.addColorStop(0, '#ffffff');
      dotGradient.addColorStop(0.3, '#3b82f6');
      dotGradient.addColorStop(1, '#1e40af');
      
      ctx.fillStyle = dotGradient;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 1.5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.restore();
    }

    
    ctx.save();
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    
    const timeSteps2 = 4;
    for (let i = 0; i <= timeSteps2; i++) {
      const time = (maxTime / timeSteps2) * i;
      const x = xScale(time);
      ctx.fillText(`${time.toFixed(0)}s`, x, height - margin.bottom + 10);
    }
    
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.textSecondary;
    const countSteps2 = 3;
    for (let i = 0; i <= countSteps2; i++) {
      const count = Math.round(minAgents + ((maxAgents - minAgents) / countSteps2) * i);
      const y = yScale(count);
      ctx.fillText(count.toString(), margin.left - 12, y);
    }
    
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText('Live Agent Count', margin.left, 8);
    
    
    if (currentFrame < agentCountData.length) {
      const currentCount = agentCountData[currentFrame].agentCount;
      const currentTime = agentCountData[currentFrame].time;
      
      
      const statsText = `${currentCount} agents • ${currentTime.toFixed(1)}s`;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(statsText).width;
      
      
      const bgGradient = ctx.createLinearGradient(
        width - textWidth - 20, 5,
        width - 10, 25
      );
      bgGradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
      bgGradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
      
      ctx.fillStyle = bgGradient;
      ctx.fillRect(width - textWidth - 20, 5, textWidth + 15, 20);
      
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(width - textWidth - 20, 5, textWidth + 15, 20);
      
      
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(statsText, width - textWidth - 12, 15);
    }
    
    ctx.restore();

    
    ctx.save();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.2)';
    ctx.shadowBlur = 4;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    ctx.restore();
  };

  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      setDimensions({ width: width || 400, height: height || 200 });
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    
    canvas.width = dimensions.width * window.devicePixelRatio;
    canvas.height = dimensions.height * window.devicePixelRatio;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    drawPlot();
  }, [dimensions, agentCountData, currentFrame]);

  
  useEffect(() => {
    drawPlot();
  }, [currentFrame, agentCountData]);

  if (!isVisible || agentCountData.length === 0) {
    return null;
  }

  return (
    <div 
      style={{
        width: '100%',
        height: '200px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(51, 65, 85, 0.6)',
        borderRadius: '12px',
        padding: '8px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}
    >
      <canvas 
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};

export default LiveAgentPlot;