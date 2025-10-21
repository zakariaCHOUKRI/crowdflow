import { GRID_SIZE, getScaleInfo, getElementCenter, snapToAngle,GRID_SNAP_THRESHOLD,getGridSnapIndicator } from '../utils/canvasUtils';

const SNAP_ANGLE_THRESHOLD = 1; 
const SNAP_DISTANCE_THRESHOLD = 1; 
const GUIDE_LINE_ALPHA = 0.7;

const LINE_WIDTH = 1;
const COLORS = {
  
  grid: 'rgba(248, 250, 252, 0.12)', 
  gridMinor: 'rgba(248, 250, 252, 0.05)', 
  axes: 'rgba(248, 250, 252, 0.2)', 
  background: '#0a0a0b', 
  
  boundary: '#6366f1',
  boundaryFill: 'rgba(99, 102, 241, 0.08)',
  boundaryGlow: 'rgba(99, 102, 241, 0.3)',
  
  openBoundary: '#64748b',
  openBoundaryActive: '#475569',
  openBoundaryGlow: 'rgba(100, 116, 139, 0.3)',
  
  obstacle: '#64748b',
  obstacleFill: 'rgba(100, 116, 139, 0.1)',
  obstacleGlow: 'rgba(100, 116, 139, 0.3)',
  
  exit: '#64748b',
  exitFill: 'rgba(100, 116, 139, 0.1)',
  exitGlow: 'rgba(100, 116, 139, 0.3)',
  
  distribution: '#6366f1',
  distributionFill: 'rgba(99, 102, 241, 0.08)',
  distributionGlow: 'rgba(99, 102, 241, 0.3)',
  
  waypoint: '#64748b',
  waypointFill: 'rgba(100, 116, 139, 0.1)',
  waypointGlow: 'rgba(100, 116, 139, 0.3)',
  
  vertex: '#64748b',
  vertexHover: '#6366f1',
  vertexActive: '#6366f1',
  vertexGlow: 'rgba(99, 102, 241, 0.4)',
  
  connection: '#6b7280',
  preview: '#6366f1',
  previewGlow: 'rgba(99, 102, 241, 0.4)',
  snap: '#6366f1',
  snapGlow: 'rgba(99, 102, 241, 0.5)',
  selected: '#6366f1',
  selectedGlow: 'rgba(99, 102, 241, 0.4)',
  
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  ruler: '#1a1a1a',
  rulerBorder: '#333333',
  crosshair: 'rgba(99, 102, 241, 0.4)',
  
  agentColors: [
    '#6366f1', '#64748b', '#475569', '#334155', '#1e293b',
    '#0f172a', '#8b5cf6', '#06b6d4', '#0ea5e9', '#3b82f6'
  ]
};

export const drawGrid = (ctx, viewOffset, zoom, canvasSize) => {
  ctx.save();
  
  
  ctx.fillStyle = COLORS.background; 
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
  
  const gridSpacingInPixels = GRID_SIZE * zoom;
  const offsetX = viewOffset.x % gridSpacingInPixels;
  const offsetY = viewOffset.y % gridSpacingInPixels;
  
  
  if (gridSpacingInPixels > 8) {
    ctx.beginPath();
    ctx.rect(30, 30, canvasSize.width - 30, canvasSize.height - 30);
    ctx.clip();
    
    const minorSpacing = gridSpacingInPixels / 5;
    if (minorSpacing > 5) {
      ctx.strokeStyle = COLORS.gridMinor; 
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      for (let x = offsetX - gridSpacingInPixels; x < canvasSize.width + gridSpacingInPixels; x += minorSpacing) {
        ctx.moveTo(x, 30);
        ctx.lineTo(x, canvasSize.height);
      }
      ctx.stroke();
      
      ctx.beginPath();
      for (let y = offsetY - gridSpacingInPixels; y < canvasSize.height + gridSpacingInPixels; y += minorSpacing) {
        ctx.moveTo(30, y);
        ctx.lineTo(canvasSize.width, y);
      }
      ctx.stroke();
    }
    
    ctx.strokeStyle = COLORS.grid; 
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    
    ctx.beginPath();
    for (let x = offsetX - gridSpacingInPixels; x < canvasSize.width + gridSpacingInPixels; x += gridSpacingInPixels) {
      ctx.moveTo(x, 30);
      ctx.lineTo(x, canvasSize.height);
    }
    ctx.stroke();
    
    ctx.beginPath();
    for (let y = offsetY - gridSpacingInPixels; y < canvasSize.height + gridSpacingInPixels; y += gridSpacingInPixels) {
      ctx.moveTo(30, y);
      ctx.lineTo(canvasSize.width, y);
    }
    ctx.stroke();
  }
  
  ctx.restore();
};

export const drawAxes = (ctx, worldToScreen, canvasSize) => {
  ctx.save();
  ctx.strokeStyle = COLORS.axes;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  
  const origin = worldToScreen(0, 0);
  
  ctx.beginPath();
  ctx.rect(30, 30, canvasSize.width - 30, canvasSize.height - 30);
  ctx.clip();
  
  ctx.shadowColor = COLORS.axes;
  ctx.shadowBlur = 3;
  
  if (origin.y >= 30 && origin.y <= canvasSize.height) {
    ctx.beginPath();
    ctx.moveTo(30, origin.y);
    ctx.lineTo(canvasSize.width, origin.y);
    ctx.stroke();
  }
  
  if (origin.x >= 30 && origin.x <= canvasSize.width) {
    ctx.beginPath();
    ctx.moveTo(origin.x, 30);
    ctx.lineTo(origin.x, canvasSize.height);
    ctx.stroke();
  }
  
  ctx.restore();
};


export const drawScaleBar = (ctx, zoom, worldToScreen, screenToWorld, canvasSize) => {
  const { realDistance: baseRealDistanceInMeters } = getScaleInfo(zoom);
  
  let realDistanceInMeters = baseRealDistanceInMeters;
  let majorTickSpacingInPixels = realDistanceInMeters * GRID_SIZE * zoom;
  
  while (majorTickSpacingInPixels < 60) {
    realDistanceInMeters *= 2;
    majorTickSpacingInPixels = realDistanceInMeters * GRID_SIZE * zoom;
  }
  while (majorTickSpacingInPixels > 180) {
    realDistanceInMeters /= 2;
    majorTickSpacingInPixels = realDistanceInMeters * GRID_SIZE * zoom;
  }
  
  ctx.save();
  ctx.font = '11px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fontWeight = '500';
  
  const worldOrigin = worldToScreen(0, 0);
  const offsetX = worldOrigin.x % majorTickSpacingInPixels;
  const offsetY = worldOrigin.y % majorTickSpacingInPixels;
  
  const horizontalGradient = ctx.createLinearGradient(0, 0, 0, 30);
  horizontalGradient.addColorStop(0, COLORS.ruler);
  horizontalGradient.addColorStop(1, 'rgba(26, 26, 29, 0.9)');
  ctx.fillStyle = horizontalGradient;
  ctx.fillRect(0, 0, canvasSize.width, 30);
  
  ctx.strokeStyle = COLORS.rulerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(canvasSize.width, 30);
  ctx.stroke();
  
  ctx.strokeStyle = COLORS.textSecondary;
  ctx.lineWidth = 1;
  for (let x = offsetX; x < canvasSize.width + majorTickSpacingInPixels; x += majorTickSpacingInPixels) {
    if (x >= 30 && x <= canvasSize.width) {
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, 18);
      ctx.stroke();
      
      const worldX = screenToWorld(x, 0).x;
      const metersX = worldX / GRID_SIZE;
      const labelText = Math.abs(metersX) < 0.01 ? '0' : metersX.toFixed(metersX % 1 === 0 ? 0 : 1);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x, 10);
      
      
      if (majorTickSpacingInPixels > 100) {
        const minorSpacing = majorTickSpacingInPixels / 5;
        ctx.strokeStyle = COLORS.textMuted;
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 5; i++) {
          const minorX = x + (minorSpacing * i);
          if (minorX >= 30 && minorX <= canvasSize.width) {
            ctx.beginPath();
            ctx.moveTo(minorX, 30);
            ctx.lineTo(minorX, 23);
            ctx.stroke();
          }
        }
      }
    }
  }
  
  
  const verticalGradient = ctx.createLinearGradient(0, 0, 30, 0);
  verticalGradient.addColorStop(0, COLORS.ruler);
  verticalGradient.addColorStop(1, 'rgba(26, 26, 29, 0.9)');
  ctx.fillStyle = verticalGradient;
  ctx.fillRect(0, 0, 30, canvasSize.height);
  
  
  ctx.strokeStyle = COLORS.rulerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(30, canvasSize.height);
  ctx.stroke();
  
  
  ctx.strokeStyle = COLORS.textSecondary;
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  for (let y = offsetY; y < canvasSize.height + majorTickSpacingInPixels; y += majorTickSpacingInPixels) {
    if (y >= 30 && y <= canvasSize.height) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(18, y);
      ctx.stroke();
      
      const worldY = screenToWorld(0, y).y;
      const metersY = (-worldY) / GRID_SIZE;
      const labelText = Math.abs(metersY) < 0.01 ? '0' : metersY.toFixed(metersY % 1 === 0 ? 0 : 1);
      ctx.save();
      ctx.translate(10, y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = COLORS.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
      
      
      if (majorTickSpacingInPixels > 100) {
        const minorSpacing = majorTickSpacingInPixels / 5;
        ctx.strokeStyle = COLORS.textMuted;
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 5; i++) {
          const minorY = y + (minorSpacing * i);
          if (minorY >= 30 && minorY <= canvasSize.height) {
            ctx.beginPath();
            ctx.moveTo(30, minorY);
            ctx.lineTo(23, minorY);
            ctx.stroke();
          }
        }
      }
    }
  }
  
  
  const cornerGradient = ctx.createRadialGradient(15, 15, 0, 15, 15, 21);
  cornerGradient.addColorStop(0, COLORS.ruler);
  cornerGradient.addColorStop(1, 'rgba(26, 26, 29, 0.8)');
  ctx.fillStyle = cornerGradient;
  ctx.fillRect(0, 0, 30, 30);
  
  ctx.restore();
};
const drawElementLabel = (ctx, center, text, zoom, color = '#ffffff') => {
  if (zoom < 0.5) return; // Only show labels at reasonable zoom levels
  
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.font = `bold ${Math.max(12, 12 * zoom)}px 'Inter', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw text with outline
  ctx.strokeText(text, center.x, center.y);
  ctx.fillText(text, center.x, center.y);
  ctx.restore();
};


export const drawCoordinates = (ctx, mousePosition, screenToWorld) => {
  if (mousePosition.x === 0 && mousePosition.y === 0) return;
  
  const worldPos = screenToWorld(mousePosition.x, mousePosition.y);
  const metersX = worldPos.x / GRID_SIZE;
  const metersY = (-worldPos.y) / GRID_SIZE;
  const text = `X: ${metersX.toFixed(2)} m  Y: ${metersY.toFixed(2)} m`;
  
  ctx.save();
  ctx.font = '12px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fontWeight = '500';
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 20;
  
  
  let tooltipX = mousePosition.x + 15;
  let tooltipY = mousePosition.y - 35;
  
  if (tooltipX + textWidth + 16 > ctx.canvas.width) {
    tooltipX = mousePosition.x - textWidth - 25;
  }
  if (tooltipY < 0) {
    tooltipY = mousePosition.y + 25;
  }
  
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  
  
  const gradient = ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + textHeight);
  gradient.addColorStop(0, 'rgba(17, 17, 19, 0.95)');
  gradient.addColorStop(1, 'rgba(26, 26, 29, 0.9)');
  ctx.fillStyle = gradient;
  
  
  ctx.beginPath();
  ctx.roundRect(tooltipX, tooltipY, textWidth + 16, textHeight, 8);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, tooltipX + (textWidth + 16)/2, tooltipY + textHeight/2);
  ctx.restore();
};


export const drawCrosshairs = (ctx, mousePosition, canvasSize) => {
  if (mousePosition.x === 0 && mousePosition.y === 0) return;
  
  ctx.save();
  ctx.strokeStyle = COLORS.crosshair;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.globalAlpha = 0.8;
  
  
  ctx.shadowColor = COLORS.crosshair;
  ctx.shadowBlur = 2;
  
  ctx.beginPath();
  ctx.moveTo(mousePosition.x, 50);
  ctx.lineTo(mousePosition.x, canvasSize.height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(30, mousePosition.y);
  ctx.lineTo(canvasSize.width, mousePosition.y);
  ctx.stroke();
  
  ctx.restore();
};


export const drawZoomLevel = (ctx, zoom, canvasSize) => {
  const text = `${(zoom * 100).toFixed(0)}%`;
  ctx.save();
  ctx.font = '12px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fontWeight = '600';
  ctx.textAlign = 'right';
  const textWidth = ctx.measureText(text).width;
  
  
  const gradient = ctx.createLinearGradient(
    canvasSize.width - textWidth - 25, 35,
    canvasSize.width - textWidth - 25, 57
  );
  gradient.addColorStop(0, 'rgba(17, 17, 19, 0.9)');
  gradient.addColorStop(1, 'rgba(26, 26, 29, 0.8)');
  ctx.fillStyle = gradient;
  
  ctx.beginPath();
  ctx.roundRect(canvasSize.width - textWidth - 25, 35, textWidth + 16, 22, 8);
  ctx.fill();
  
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasSize.width - 9, 46);
  ctx.restore();
};


export const drawVertices = (ctx, elements, worldToScreen, hoveredVertex, activeBoundary) => {
  const vertexRadius = 0.2; 
  const hoverRadius = 4; 
  const glowRadius = 1; 
  
  
  const drawModernVertex = (screen, color, glowColor, isHovered, isActive = false) => {
    ctx.save();
    
    
    if (isHovered || isActive) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, glowRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    
    const radius = isHovered ? hoverRadius : vertexRadius;
    
    
    const gradient = ctx.createRadialGradient(
      screen.x - radius * 0.3, screen.y - radius * 0.3, 0,
      screen.x, screen.y, radius
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '99'); 
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    
    if (isHovered || isActive) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(screen.x - radius * 0.2, screen.y - radius * 0.2, radius * 0.3, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    ctx.restore();
  };
  
  
  if (activeBoundary.length > 0) {
    activeBoundary.forEach((point, pointIndex) => {
      const screen = worldToScreen(point.x, point.y);
      const isHovered = hoveredVertex && hoveredVertex.type === 'activeBoundary' && hoveredVertex.pointIndex === pointIndex;
      drawModernVertex(screen, COLORS.vertexActive, COLORS.vertexGlow, isHovered, true);
    });
  }
  
  
  if (elements.openBoundaries) {
    elements.openBoundaries.forEach((openBoundary, openBoundaryIndex) => {
      openBoundary.points.forEach((point, pointIndex) => {
        const screen = worldToScreen(point.x, point.y);
        const isHovered = hoveredVertex && hoveredVertex.type === 'openBoundary' && 
                         hoveredVertex.elementIndex === openBoundaryIndex && hoveredVertex.pointIndex === pointIndex;
        const color = openBoundary.type === 'obstacle' ? COLORS.obstacle : COLORS.preview;
        const glowColor = openBoundary.type === 'obstacle' ? COLORS.obstacleGlow : COLORS.previewGlow;
        
        drawModernVertex(screen, color, glowColor, isHovered);
        
        
        if (!isHovered) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 1.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        }
      });
    });
  }
  
  
  elements.boundaries.forEach((boundary, boundaryIndex) => {
    boundary.points.forEach((point, pointIndex) => {
      const screen = worldToScreen(point.x, point.y);
      const isHovered = hoveredVertex && hoveredVertex.type === 'boundary' && 
                       hoveredVertex.elementIndex === boundaryIndex && hoveredVertex.pointIndex === pointIndex;
      drawModernVertex(screen, COLORS.boundary, COLORS.boundaryGlow, isHovered);
    });
  });
  
  
  (elements.obstacles || []).forEach((obstacle, obstacleIndex) => {
    obstacle.points.forEach((point, pointIndex) => {
      const screen = worldToScreen(point.x, point.y);
      const isHovered = hoveredVertex && hoveredVertex.type === 'obstacle' && 
                       hoveredVertex.elementIndex === obstacleIndex && hoveredVertex.pointIndex === pointIndex;
      drawModernVertex(screen, COLORS.obstacle, COLORS.obstacleGlow, isHovered);
    });
  });
  
  
  elements.exits.forEach((exit, exitIndex) => {
    exit.points.forEach((point, pointIndex) => {
      const screen = worldToScreen(point.x, point.y);
      const isHovered = hoveredVertex && hoveredVertex.type === 'exit' && 
                       hoveredVertex.elementIndex === exitIndex && hoveredVertex.pointIndex === pointIndex;
      drawModernVertex(screen, COLORS.exit, COLORS.exitGlow, isHovered);
    });
  });
  
  
  elements.distributions.forEach((dist, distIndex) => {
    dist.points.forEach((point, pointIndex) => {
      const screen = worldToScreen(point.x, point.y);
      const isHovered = hoveredVertex && hoveredVertex.type === 'distribution' && 
                       hoveredVertex.elementIndex === distIndex && hoveredVertex.pointIndex === pointIndex;
      drawModernVertex(screen, COLORS.distribution, COLORS.distributionGlow, isHovered);
    });
  });
  
  
  elements.waypoints.forEach((waypoint, waypointIndex) => {
    const screen = worldToScreen(waypoint.center.x, waypoint.center.y);
    const isHovered = hoveredVertex && hoveredVertex.type === 'waypoint' && hoveredVertex.elementIndex === waypointIndex;
    drawModernVertex(screen, COLORS.waypoint, COLORS.waypointGlow, isHovered);
  });
};

const getJourneyColor = (journeyId) => {
  const colors = [
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#22c55e', // Green
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#eab308', // Yellow
  '#14b8a6', // Teal
  '#8b5cf6', // Purple
  '#d946ef', // Magenta
  '#84cc16', // Lime
  '#2563eb', // Royal Blue
  '#ec4899', // Pink
  '#16a34a', // Forest Green
  '#0ea5e9', // Sky Blue
  '#a855f7', // Violet
  '#f43f5e', // Rose
  '#a16207', // Olive
  '#3b82f6', // Blue
  '#78350f', // Brown
  '#64748b'  // Slate Gray
];


  const match = journeyId.match(/^J(\d+)$/);
  const journeyNumber = match ? parseInt(match[1]) - 1 : 0;
  return colors[journeyNumber % colors.length];
};
export const drawElements = (ctx, elements, worldToScreen, zoom, selectedElements, journeyConnections, elementVisibility = {}, highlightedElement = null, individualElementVisibility, editingWaypoint) => {

  const drawElementWithGlow = (drawFunction, glowColor, isSelected = false, isHighlighted = false) => {
    if (isHighlighted) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.9;
      drawFunction();
      ctx.restore();
    } else if (isSelected) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.8;
      drawFunction();
      ctx.restore();
    }
    drawFunction();
  };
  
  // Open boundaries (always visible - they're temporary)
  if (elements.openBoundaries) {
    elements.openBoundaries.forEach((openBoundary) => {
      if (openBoundary.points.length < 2) return;
      ctx.save();
      
      const color = openBoundary.type === 'obstacle' ? COLORS.obstacle : COLORS.preview;
      const glowColor = openBoundary.type === 'obstacle' ? COLORS.obstacleGlow : COLORS.previewGlow;
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.8;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 4; 
      ctx.setLineDash([12, 8]); 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      openBoundary.points.forEach((point, i) => {
        const screen = worldToScreen(point.x, point.y);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      });
      ctx.stroke();
      ctx.restore();
    });
  }
  
  // Journey Connections
  if (elementVisibility.journeyConnections !== false) {
    journeyConnections.forEach((connection, index) => {
      // console.log('connectionId', connection.id, 'highlightedElement', highlightedElement);
      ctx.save();
      
      const connectionId = `${connection.journeyId}_${connection.fromId}_${connection.toId}`;
      const isHighlighted = highlightedElement?.connectionId === connectionId;
      const journeyColor = getJourneyColor(connection.journeyId || 'J1');
      if (individualElementVisibility[connectionId] === false) return;
      
      if (connection.routingMode === 'shortest-path' && connection.waypoints) {
        // Draw shortest path with multiple segments
        if (isHighlighted) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 6;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
        } else {
          ctx.strokeStyle = journeyColor;
          ctx.lineWidth = 3;
          ctx.shadowColor = journeyColor + '66';
          ctx.shadowBlur = 6;
        }
        
        ctx.setLineDash([8, 4]);
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        connection.waypoints.forEach((waypoint, index) => {
          const screen = worldToScreen(waypoint[0], waypoint[1]);
          if (index === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        ctx.stroke();
        
        // Draw waypoint indicators for shortest path
        if (zoom > 0.5) {
          connection.waypoints.slice(1, -1).forEach(waypoint => {
            const screen = worldToScreen(waypoint[0], waypoint[1]);
            ctx.fillStyle = isHighlighted ? '#fbbf24' : journeyColor;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
        
        // Draw arrow at the end
        if (connection.waypoints.length >= 2) {
          const lastWaypoint = connection.waypoints[connection.waypoints.length - 1];
          const secondLastWaypoint = connection.waypoints[connection.waypoints.length - 2];
          
          const lastScreen = worldToScreen(lastWaypoint[0], lastWaypoint[1]);
          const secondLastScreen = worldToScreen(secondLastWaypoint[0], secondLastWaypoint[1]);
          
          const angle = Math.atan2(lastScreen.y - secondLastScreen.y, lastScreen.x - secondLastScreen.x);
          const arrowLength = 18;
          
          ctx.setLineDash([]);
          ctx.fillStyle = isHighlighted ? '#fbbf24' : journeyColor;
          ctx.shadowBlur = 4;
          
          ctx.beginPath();
          ctx.moveTo(lastScreen.x, lastScreen.y);
          ctx.lineTo(
            lastScreen.x - arrowLength * Math.cos(angle - Math.PI / 6),
            lastScreen.y - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            lastScreen.x - arrowLength * 0.7 * Math.cos(angle),
            lastScreen.y - arrowLength * 0.7 * Math.sin(angle)
          );
          ctx.lineTo(
            lastScreen.x - arrowLength * Math.cos(angle + Math.PI / 6),
            lastScreen.y - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        
      } else {
        // Draw direct connection (original arrows)
        const fromCenter = getElementCenter(connection.from);
        const toCenter = getElementCenter(connection.to);
        
        if (fromCenter && toCenter) {
          const fromScreen = worldToScreen(fromCenter.x, fromCenter.y);
          const toScreen = worldToScreen(toCenter.x, toCenter.y);
          
          if (isHighlighted) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 15;
          } else {
            ctx.strokeStyle = journeyColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = journeyColor + '66';
            ctx.shadowBlur = 4;
          }
          
          ctx.setLineDash([12, 8]);
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(fromScreen.x, fromScreen.y);
          ctx.lineTo(toScreen.x, toScreen.y);
          ctx.stroke();
          
          // Arrow with same color
          const angle = Math.atan2(toScreen.y - fromScreen.y, toScreen.x - fromScreen.x);
          const arrowLength = 18;
          
          ctx.setLineDash([]);
          ctx.fillStyle = isHighlighted ? '#fbbf24' : journeyColor;
          
          ctx.beginPath();
          ctx.moveTo(toScreen.x, toScreen.y);
          ctx.lineTo(
            toScreen.x - arrowLength * Math.cos(angle - Math.PI / 6),
            toScreen.y - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            toScreen.x - arrowLength * 0.7 * Math.cos(angle),
            toScreen.y - arrowLength * 0.7 * Math.sin(angle)
          );
          ctx.lineTo(
            toScreen.x - arrowLength * Math.cos(angle + Math.PI / 6),
            toScreen.y - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }
  
  // Boundaries
  if (elementVisibility.boundaries !== false) {
    elements.boundaries.forEach((boundary) => {
      if (individualElementVisibility[boundary.id] === false) return;
      if (boundary.points.length < 3) return;
      const isSelected = selectedElements.some(sel => sel.element.id === boundary.id);
      const isHighlighted = highlightedElement?.id === boundary.id;
      
      const drawBoundary = () => {
        ctx.save();
        if (isHighlighted) {
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.boundary;
          ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.08)' : COLORS.boundaryFill;
          ctx.lineWidth = isSelected ? 2 : 2;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        boundary.points.forEach((point, i) => {
          const screen = worldToScreen(point.x, point.y);
          if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        
        if (boundary.closed) {
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
      };
      
      drawElementWithGlow(drawBoundary, isSelected ? COLORS.selectedGlow : COLORS.boundaryGlow, isSelected, isHighlighted);
    });
  }
  
  // Obstacles
  if (elementVisibility.obstacles !== false) {
    (elements.obstacles || []).forEach((obstacle) => {
      if (individualElementVisibility[obstacle.id] === false) return;
      const isSelected = selectedElements.some(sel => sel.element.id === obstacle.id);
      const isHighlighted = highlightedElement?.id === obstacle.id;
      
      const drawObstacle = () => {
        ctx.save();
        if (isHighlighted) {
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.obstacle;
          ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.15)' : COLORS.obstacleFill;
          ctx.lineWidth = isSelected ? 2 : 2;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([12, 6]);
        
        ctx.beginPath();
        obstacle.points.forEach((point, i) => {
          const screen = worldToScreen(point.x, point.y);
          if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      
      drawElementWithGlow(drawObstacle, isSelected ? COLORS.selectedGlow : COLORS.obstacleGlow, isSelected, isHighlighted);
    });
  }
  
  // Exits
  if (elementVisibility.exits !== false) {
    elements.exits.forEach((exit, index) => {
      if (individualElementVisibility[exit.id] === false) return;
      const isSelected = selectedElements.some(sel => sel.element.id === exit.id);
      const isHighlighted = highlightedElement?.id === exit.id;
      
      const drawExit = () => {
        ctx.save();
        if (isHighlighted) {
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.exit;
          ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.12)' : COLORS.exitFill;
          ctx.lineWidth = isSelected ? 2 : 2;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        exit.points.forEach((point, i) => {
          const screen = worldToScreen(point.x, point.y);
          if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      
      drawElementWithGlow(drawExit, isSelected ? COLORS.selectedGlow : COLORS.exitGlow, isSelected, isHighlighted);

      const centerX = exit.points.reduce((sum, p) => sum + p.x, 0) / exit.points.length;
      const centerY = exit.points.reduce((sum, p) => sum + p.y, 0) / exit.points.length;
      const center = worldToScreen(centerX, centerY);
      drawElementLabel(ctx, center, `E${index}`, zoom, '#ffffff');
    });
  }
  
  // Distributions
  if (elementVisibility.distributions !== false) {
    elements.distributions.forEach((dist, index) => {
      if (individualElementVisibility[dist.id] === false) return;
      const isSelected = selectedElements.some(sel => sel.element.id === dist.id);
      const isHighlighted = highlightedElement?.id === dist.id;
      
      const drawDistribution = () => {
        ctx.save();
        if (isHighlighted) {
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.distribution;
          ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.12)' : COLORS.distributionFill;
          ctx.lineWidth = isSelected ? 2 : 2;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        dist.points.forEach((point, i) => {
          const screen = worldToScreen(point.x, point.y);
          if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      
      drawElementWithGlow(drawDistribution, isSelected ? COLORS.selectedGlow : COLORS.distributionGlow, isSelected, isHighlighted);
      const centerX = dist.points.reduce((sum, p) => sum + p.x, 0) / dist.points.length;
      const centerY = dist.points.reduce((sum, p) => sum + p.y, 0) / dist.points.length;
      const center = worldToScreen(centerX, centerY);
      drawElementLabel(ctx, center, `D${index}`, zoom, '#ffffff');
    });
  }
  
// Waypoints
if (elementVisibility.waypoints !== false) {
  elements.waypoints.forEach((waypoint, index) => {
    if (individualElementVisibility[waypoint.id] === false) return;
    const center = worldToScreen(waypoint.center.x, waypoint.center.y);
    const radius = waypoint.radius * zoom;
    const isSelected = selectedElements.some(sel => sel.element.id === waypoint.id);
    const isHighlighted = highlightedElement?.id === waypoint.id;
    const isEditing = editingWaypoint === waypoint.id; // Add this parameter
    
    const drawWaypoint = () => {
      ctx.save();
      if (isHighlighted) {
        ctx.strokeStyle = '#fbbf24';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.waypoint;
        ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.12)' : COLORS.waypointFill;
        ctx.lineWidth = isSelected ? 2 : 2;
      }
      
      ctx.setLineDash([8, 6]);
      
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Draw radius handles if editing
      if (isEditing) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#3b82f6';
        ctx.lineWidth = 2;
        
        // Draw 4 resize handles at cardinal directions
        const handlePositions = [
          { x: center.x + radius, y: center.y }, // Right
          { x: center.x - radius, y: center.y }, // Left
          { x: center.x, y: center.y + radius }, // Bottom
          { x: center.x, y: center.y - radius }  // Top
        ];
        
        handlePositions.forEach(pos => {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        
        // Draw radius line with measurement
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(center.x + radius, center.y);
        ctx.stroke();
        
        // Show radius value
        ctx.fillStyle = '#3b82f6';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${waypoint.radius.toFixed(0)}px`, center.x + radius/2, center.y - 5);
      }
      
      ctx.restore();
    };
    
    drawElementWithGlow(drawWaypoint, isSelected ? COLORS.selectedGlow : COLORS.waypointGlow, isSelected, isHighlighted);

    drawElementLabel(ctx, center, `WP${index}`, zoom, '#ffffff');
  });
}

}

  
  export const drawActiveDrawing = (ctx, drawingMode, activeBoundary, worldToScreen, connections, showPreviewLine, previewPoint, lastConnectedPoint, hoveredSnapVertex, isDragging, dragStart, dragCurrent, SNAP_RADIUS) => {
    if ((drawingMode === 'walkablearea' || drawingMode === 'obstacle') && activeBoundary.length > 0) {
      ctx.save();
      
      const color = drawingMode === 'obstacle' ? COLORS.obstacle : COLORS.preview;
      const glowColor = drawingMode === 'obstacle' ? COLORS.obstacleGlow : COLORS.previewGlow;
      
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
      
      ctx.beginPath();
      connections.forEach(connection => {
        const fromPoint = activeBoundary[connection.from];
        const toPoint = activeBoundary[connection.to];
        if (fromPoint && toPoint) {
          const fromScreen = worldToScreen(fromPoint.x, fromPoint.y);
          const toScreen = worldToScreen(toPoint.x, toPoint.y);
          ctx.moveTo(fromScreen.x, fromScreen.y);
          ctx.lineTo(toScreen.x, toScreen.y);
        }
      });
      ctx.stroke();
      
      
      if (showPreviewLine && previewPoint && lastConnectedPoint !== null) {
        const fromPoint = activeBoundary[lastConnectedPoint];
        const fromScreen = worldToScreen(fromPoint.x, fromPoint.y);
        const previewScreen = worldToScreen(previewPoint.x, previewPoint.y);
        
        ctx.save();
        ctx.strokeStyle = COLORS.preview;
        ctx.lineWidth = 2; 
        ctx.setLineDash([10, 8]); 
        ctx.globalAlpha = 0.9; 
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(fromScreen.x, fromScreen.y);
        ctx.lineTo(previewScreen.x, previewScreen.y);
        ctx.stroke();
        ctx.restore();
      }
      
      
      activeBoundary.forEach((point, i) => {
        const screen = worldToScreen(point.x, point.y);
        const isLastConnected = i === lastConnectedPoint;
        
        ctx.save();
        
        if (isLastConnected) {
          
          ctx.shadowColor = COLORS.snapGlow;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = COLORS.snap;
          ctx.lineWidth = 2; 
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 12, 0, 2 * Math.PI);
          ctx.stroke();
        }
        
        
        const gradient = ctx.createRadialGradient(
          screen.x - 3, screen.y - 3, 0,
          screen.x, screen.y, 8
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80');
        
        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2; 
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8, 0, 2 * Math.PI); 
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
      });
      
      
      if (hoveredSnapVertex) {
        const snapScreen = worldToScreen(hoveredSnapVertex.point.x, hoveredSnapVertex.point.y);
        
        ctx.save();
        
        ctx.shadowColor = COLORS.snapGlow;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = COLORS.snap;
        ctx.lineWidth = 2; 
        ctx.beginPath();
        ctx.arc(snapScreen.x, snapScreen.y, 16, 0, 2 * Math.PI);
        ctx.stroke();
        
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLORS.snap;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(snapScreen.x, snapScreen.y, SNAP_RADIUS, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    
    
    if ((drawingMode === 'exit' || drawingMode === 'distribution' || drawingMode === 'obstacle') && isDragging && dragStart && dragCurrent) {
      ctx.save();
      const startScreen = worldToScreen(dragStart.x, dragStart.y);
      const currentScreen = worldToScreen(dragCurrent.x, dragCurrent.y);
      const x = Math.min(startScreen.x, currentScreen.x);
      const y = Math.min(startScreen.y, currentScreen.y);
      const width = Math.abs(currentScreen.x - startScreen.x);
      const height = Math.abs(currentScreen.y - startScreen.y);
      
      let strokeColor, fillColor, glowColor;
      if (drawingMode === 'exit') {
        strokeColor = COLORS.exit;
        fillColor = COLORS.exitFill;
        glowColor = COLORS.exitGlow;
      } else if (drawingMode === 'distribution') {
        strokeColor = COLORS.distribution;
        fillColor = COLORS.distributionFill;
        glowColor = COLORS.distributionGlow;
      } else if (drawingMode === 'obstacle') {
        strokeColor = COLORS.obstacle;
        fillColor = COLORS.obstacleFill;
        glowColor = COLORS.obstacleGlow;
      }
      
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 2; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (drawingMode === 'obstacle') {
        ctx.setLineDash([10, 6]); 
      } else {
        ctx.setLineDash([8, 8]); 
      }
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
  };

export const drawBoundaryRulers = (ctx, boundaries, activeBoundary, worldToScreen, screenToWorld, canvasSize, zoom) => {
  
  const allBoundaries = [...boundaries];
  if (activeBoundary.length > 0) {
    allBoundaries.push({ points: activeBoundary });
  }
  
  if (allBoundaries.length === 0) return;
  
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  allBoundaries.forEach(boundary => {
    boundary.points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
  });
  
  if (!isFinite(minX)) return;
  
  
  const topLeft = worldToScreen(minX, minY);
  const bottomRight = worldToScreen(maxX, maxY);
  
  
  const widthMeters = Math.abs(maxX - minX) / GRID_SIZE;
  const heightMeters = Math.abs(maxY - minY) / GRID_SIZE;
  
  ctx.save();
  
  
  ctx.strokeStyle = '#fbbf24'; 
  ctx.fillStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.font = 'bold 12px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  
  
  if (topLeft.x >= 30 && bottomRight.x <= canvasSize.width && topLeft.y > 30) {
    
    ctx.beginPath();
    ctx.moveTo(topLeft.x, 35);
    ctx.lineTo(bottomRight.x, 35);
    ctx.stroke();
    
    
    ctx.beginPath();
    ctx.moveTo(topLeft.x, 32);
    ctx.lineTo(topLeft.x, 38);
    ctx.moveTo(bottomRight.x, 32);
    ctx.lineTo(bottomRight.x, 38);
    ctx.stroke();
    
    
    const widthTextX = (topLeft.x + bottomRight.x) / 2;
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${widthMeters.toFixed(1)}m`, widthTextX, 25);
  }
  
  
  if (topLeft.y >= 30 && bottomRight.y <= canvasSize.height && topLeft.x > 30) {
    
    ctx.beginPath();
    ctx.moveTo(35, topLeft.y);
    ctx.lineTo(35, bottomRight.y);
    ctx.stroke();
    
    
    ctx.beginPath();
    ctx.moveTo(32, topLeft.y);
    ctx.lineTo(38, topLeft.y);
    ctx.moveTo(32, bottomRight.y);
    ctx.lineTo(38, bottomRight.y);
    ctx.stroke();
    
    
    const heightTextY = (topLeft.y + bottomRight.y) / 2;
    ctx.save();
    ctx.translate(15, heightTextY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${heightMeters.toFixed(1)}m`, 0, 0);
    ctx.restore();
  }
  
  ctx.restore();
};


export const drawSnapGuides = (ctx, snapGuide, worldToScreen) => {
  if (!snapGuide) return;
  
  ctx.save();
  
  
  ctx.strokeStyle = snapGuide.type === 'horizontal' ? '#3b82f6' : '#10b981';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.globalAlpha = GUIDE_LINE_ALPHA;
  ctx.lineCap = 'round';
  
  
  ctx.shadowColor = snapGuide.type === 'horizontal' ? '#3b82f6' : '#10b981';
  ctx.shadowBlur = 8;
  
  
  const startScreen = worldToScreen(snapGuide.guideLine.start.x, snapGuide.guideLine.start.y);
  const endScreen = worldToScreen(snapGuide.guideLine.end.x, snapGuide.guideLine.end.y);
  
  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(endScreen.x, endScreen.y);
  ctx.stroke();
  
  
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = snapGuide.type === 'horizontal' ? '#3b82f6' : '#10b981';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  
  const iconX = (startScreen.x + endScreen.x) / 2;
  const iconY = (startScreen.y + endScreen.y) / 2;
  
  
  ctx.beginPath();
  ctx.arc(iconX, iconY, 12, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fill();
  
  
  ctx.fillStyle = snapGuide.type === 'horizontal' ? '#3b82f6' : '#10b981';
  ctx.fillText(snapGuide.type === 'horizontal' ? '—' : '|', iconX, iconY);
  
  ctx.restore();
};

export const drawStaticElementsInSimulation = (
  ctx,
  elements,
  zoom,
  isSimulationMode,
  simulationToScreen,
  calculateOriginalBounds,
 
  transformToSimulationCoords,
  THEME_COLORS,
  DISPLAY_SCALE,
  viewOffset,
) => {
    if (!isSimulationMode || elements.boundaries.length === 0) return;
    
    const bounds = calculateOriginalBounds();
    
    ctx.save();
    ctx.globalAlpha = 0.7; 
    
    
    elements.boundaries.forEach((boundary) => {
      if (boundary.points.length < 3) return;

      
      const transformedBoundary = transformToSimulationCoords(boundary, bounds);
      
      ctx.strokeStyle = THEME_COLORS.boundary;
      ctx.fillStyle = THEME_COLORS.boundaryFill;
      ctx.lineWidth = 3; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      transformedBoundary.points.forEach((point, i) => {
        const screen = simulationToScreen(point.x, point.y, zoom, viewOffset);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      });
      
      if (boundary.closed) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
    });

    
    if (elements.obstacles && elements.obstacles.length > 0) {
      elements.obstacles.forEach((obstacle) => {
        const transformedObstacle = transformToSimulationCoords(obstacle, bounds);
        
        ctx.strokeStyle = THEME_COLORS.obstacle;
        ctx.fillStyle = THEME_COLORS.obstacleFill;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([12, 6]); 
        
        ctx.beginPath();
        transformedObstacle.points.forEach((point, i) => {
          const screen = simulationToScreen(point.x, point.y, zoom, viewOffset);
          if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
          } else {
            ctx.lineTo(screen.x, screen.y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    
    elements.exits.forEach((exit) => {
      const transformedExit = transformToSimulationCoords(exit, bounds);
      
      ctx.strokeStyle = THEME_COLORS.exit;
      ctx.fillStyle = THEME_COLORS.exitFill;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      transformedExit.points.forEach((point, i) => {
        const screen = simulationToScreen(point.x, point.y, zoom, viewOffset);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      
      if (zoom > 0.5) {
        const centerX = transformedExit.points.reduce((sum, p) => sum + p.x, 0) / transformedExit.points.length;
        const centerY = transformedExit.points.reduce((sum, p) => sum + p.y, 0) / transformedExit.points.length;
        const labelPos = simulationToScreen(centerX, centerY, zoom, viewOffset);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = THEME_COLORS.exit;
        ctx.lineWidth = 2;
        ctx.font = `bold ${Math.max(11, 14 * zoom)}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('EXIT', labelPos.x, labelPos.y);
        ctx.fillText('EXIT', labelPos.x, labelPos.y);
      }
    });

    
    elements.distributions.forEach((dist) => {
      const transformedDist = transformToSimulationCoords(dist, bounds);
      
      ctx.strokeStyle = THEME_COLORS.distribution;
      ctx.fillStyle = THEME_COLORS.distributionFill;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      transformedDist.points.forEach((point, i) => {
        const screen = simulationToScreen(point.x, point.y, zoom, viewOffset);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      
      if (zoom > 0.5) {
        const centerX = transformedDist.points.reduce((sum, p) => sum + p.x, 0) / transformedDist.points.length;
        const centerY = transformedDist.points.reduce((sum, p) => sum + p.y, 0) / transformedDist.points.length;
        const labelPos = simulationToScreen(centerX, centerY, zoom, viewOffset);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = THEME_COLORS.distribution;
        ctx.lineWidth = 2;
        ctx.font = `bold ${Math.max(11, 14 * zoom)}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('START', labelPos.x, labelPos.y);
        ctx.fillText('START', labelPos.x, labelPos.y);
      }
    });

    
    elements.waypoints.forEach((waypoint) => {
      const transformedWaypoint = transformToSimulationCoords(waypoint, bounds);
      const center = simulationToScreen(transformedWaypoint.center.x, transformedWaypoint.center.y,zoom, viewOffset);
      const radius = transformedWaypoint.radius * DISPLAY_SCALE * zoom;
      
      ctx.strokeStyle = THEME_COLORS.waypoint;
      ctx.fillStyle = THEME_COLORS.waypointFill;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    ctx.restore();

  };

 
 export const drawSimulationElements = (
  ctx,
  trajectoryData,
  currentFrame,
  agentTrails,
  agentRadiusData,
  agentColorData,
  zoom,
  isSimulationMode,
  simulationToScreen,
  DISPLAY_SCALE,
  updateAgentTrails,
  viewOffset,
  journeyConnections,
  colorByExit = false,
  colorByDistribution = false,
  agentDistributionColors = new Map(),
  agentExitColors = new Map(),
  showAgentTrails = false, 
  
) => {
  if (!isSimulationMode || !trajectoryData[currentFrame]) return;

  const AGENT_COLORS = [
    '#ffffff', 
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',  
  ];

  // Zoom thresholds for different features
  const ARROW_ZOOM_THRESHOLD = 2; // Adjust this value based on your needs

  
   if (showAgentTrails) {
  ctx.save();
  ctx.strokeStyle = '#22c55e'; // Green
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.7;
  
  // For each agent, draw trail from start up to current frame
  const agentTrails = new Map();
  
  // Build trails up to current frame
  for (let frameIndex = 0; frameIndex <= currentFrame; frameIndex++) {
    if (!trajectoryData[frameIndex]) continue;
    
    trajectoryData[frameIndex].agents.forEach(agent => {
      if (!agentTrails.has(agent.agent_id)) {
        agentTrails.set(agent.agent_id, []);
      }
      agentTrails.get(agent.agent_id).push({ x: agent.x, y: agent.y });
    });
  }
  
  // Draw each trail
  agentTrails.forEach(trail => {
    if (trail.length < 2) return;
    
    ctx.beginPath();
    trail.forEach((point, i) => {
      const screen = simulationToScreen(point.x, point.y, zoom, viewOffset);
      if (i === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
  });
  
  ctx.restore();
}

  const frameData = trajectoryData[currentFrame];
  
  updateAgentTrails(frameData);
  
  ctx.save();
  // agentTrails.forEach((trail, agentId) => {
  //   if (trail.length < 2) return;
    
  //   const colorIndex = parseInt(agentId) % AGENT_COLORS.length;
  //   const baseColor = AGENT_COLORS[colorIndex];
    
  //   ctx.strokeStyle = baseColor;
  //   ctx.lineWidth = 3 * zoom; 
  //   ctx.lineCap = 'round';
  //   ctx.lineJoin = 'round';
    
    
  //   for (let i = 1; i < trail.length; i++) {
  //     const prev = trail[i - 1];
  //     const curr = trail[i];
      
  //     const progress = i / trail.length;
  //     const alpha = Math.pow(progress, 0.8) * 0.7; 
  //     ctx.globalAlpha = alpha;

  //     const prevScreen = simulationToScreen(prev.x, prev.y, zoom, viewOffset);
  //     const currScreen = simulationToScreen(curr.x, curr.y, zoom, viewOffset);

  //     ctx.beginPath();
  //     ctx.moveTo(prevScreen.x, prevScreen.y);
  //     ctx.lineTo(currScreen.x, currScreen.y);
  //     ctx.stroke();
  //   }
  // });
  ctx.restore();
  
  // Check if we should render arrows based on zoom level
  const shouldRenderArrows = zoom >= ARROW_ZOOM_THRESHOLD;
  
  frameData.agents.forEach((agent, index) => {
    const position = simulationToScreen(agent.x, agent.y, zoom, viewOffset);
    const agentRadius = (agentRadiusData[agent.agent_id] || 0.2) * DISPLAY_SCALE * zoom;
    let agentColor;
    if (colorByDistribution && agentDistributionColors.has(agent.agent_id)) {
      agentColor = agentDistributionColors.get(agent.agent_id);
    } else if (colorByExit && agentExitColors.has(agent.agent_id)) {
      agentColor = agentExitColors.get(agent.agent_id);
    } else {
      // Default coloring
      const colorIndex = agent.agent_id % AGENT_COLORS.length;
      agentColor = AGENT_COLORS[colorIndex];
    }
    
    ctx.save();
    
    // Draw shadow
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    // ctx.beginPath();
    // ctx.arc(position.x + 1.5, position.y + 1.5, agentRadius, 0, 2 * Math.PI);
    // ctx.fill();
    
    // Draw agent body with gradient
    const gradient = ctx.createRadialGradient(
      position.x - agentRadius * 0.3, position.y - agentRadius * 0.3, 0,
      position.x, position.y, agentRadius
    );
    gradient.addColorStop(0, agentColor);
    gradient.addColorStop(0.7, agentColor + 'cc');
    gradient.addColorStop(1, agentColor + '88');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = agentColor;
    ctx.lineWidth =2.5; 
    
    ctx.beginPath();
    ctx.arc(position.x, position.y, agentRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Only draw orientation arrows if zoom is high enough
    if (shouldRenderArrows && agent.ori_x !== undefined && agent.ori_y !== undefined) {
      const arrowLength = agentRadius * 0.75;
      const arrowEndX = position.x + agent.ori_x * arrowLength;
      const arrowEndY = position.y + agent.ori_y * arrowLength;
      
      // Arrow styling
      ctx.strokeStyle = '#000000ff';
      ctx.fillStyle = '#000000ff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw arrow shaft
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
      ctx.lineTo(arrowEndX, arrowEndY);
      ctx.stroke();
      
      // Draw arrow head
      const angle = Math.atan2(agent.ori_y, agent.ori_x);
      const headLength = agentRadius * 0.4;
      const headAngle = Math.PI / 5; 
      
      ctx.beginPath();
      ctx.moveTo(arrowEndX, arrowEndY);
      ctx.lineTo(
        arrowEndX - headLength * Math.cos(angle - headAngle),
        arrowEndY - headLength * Math.sin(angle - headAngle)
      );
      ctx.lineTo(
        arrowEndX - headLength * Math.cos(angle + headAngle),
        arrowEndY - headLength * Math.sin(angle + headAngle)
      );
      ctx.closePath();
      ctx.fill();
    }
    
    // Agent ID labels (commented out but available for high zoom)
    // if (zoom > 0.9) {
    //   ctx.fillStyle = '#1e293b';
    //   ctx.font = `600 ${Math.max(9, 11 * zoom)}px 'Inter', system-ui, sans-serif`;
    //   ctx.textAlign = 'center';
    //   ctx.textBaseline = 'middle';
      
    //   const textMetrics = ctx.measureText(agent.agent_id.toString());
    //   const textWidth = textMetrics.width;
    //   const textHeight = 12 * zoom;
    //   const textY = position.y - agentRadius - 12;
      
    //   ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    //   ctx.fillRect(
    //     position.x - textWidth/2 - 4, 
    //     textY - textHeight/2 - 2, 
    //     textWidth + 8, 
    //     textHeight + 4
    //   );
      
    //   ctx.fillStyle = '#1e293b';
    //   ctx.fillText(agent.agent_id.toString(), position.x, textY);
    // }
    
    ctx.restore();
  });
};

export const drawDensityHeatmap = (ctx, heatmapData, simulationToScreen, viewOffset, zoom, DISPLAY_SCALE) => {
  if (!heatmapData || !heatmapData.density_grid || !heatmapData.success) return;
  
  const { density_grid, grid_size, bounds } = heatmapData;
  const rows = density_grid.length;
  const cols = density_grid[0]?.length || 0;
  
  if (rows === 0 || cols === 0) return;
  
  // Find min/max density for color scaling (ignore zeros)
  let minDensity = Infinity;
  let maxDensity = -Infinity;
  
  for (let row of density_grid) {
    for (let val of row) {
      if (val > 0) {
        minDensity = Math.min(minDensity, val);
        maxDensity = Math.max(maxDensity, val);
      }
    }
  }
  
  // If no valid density data, return
  if (!isFinite(minDensity) || !isFinite(maxDensity)) return;
  
  ctx.save();
  
  // Draw heatmap cells
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const density = density_grid[i][j];
      if (density <= 0) continue;
      
      // Calculate cell position in walkable area coordinates
      const cellX = bounds.minX + j * grid_size;
      const cellY = bounds.maxY - (i + 1) * grid_size;


      
      // Convert to screen coordinates using simulationToScreen
      const screenPos = simulationToScreen(cellX, cellY, zoom, viewOffset);
      const cellScreenSize = grid_size * DISPLAY_SCALE * zoom;
      
      // Normalize density value (0 to 1)
      const normalized = (density - minDensity) / (maxDensity - minDensity);
      const alpha = 0.6; // Transparency
      
      // Heat color scale: Blue (low) -> Cyan -> Green -> Yellow -> Orange -> Red (high)
      let r, g, b;
      if (normalized < 0.25) {
        // Blue to Cyan
        const t = normalized / 0.25;
        r = 0;
        g = Math.floor(t * 255);
        b = 255;
      } else if (normalized < 0.5) {
        // Cyan to Green
        const t = (normalized - 0.25) / 0.25;
        r = 0;
        g = 255;
        b = Math.floor((1 - t) * 255);
      } else if (normalized < 0.75) {
        // Green to Yellow
        const t = (normalized - 0.5) / 0.25;
        r = Math.floor(t * 255);
        g = 255;
        b = 0;
      } else {
        // Yellow to Red
        const t = (normalized - 0.75) / 0.25;
        r = 255;
        g = Math.floor((1 - t) * 255);
        b = 0;
      }
      
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(screenPos.x, screenPos.y, cellScreenSize, cellScreenSize);
    }
  }
  
  // Draw legend
  drawHeatmapLegend(ctx, minDensity, maxDensity);
  
  ctx.restore();
};

// Helper function to draw heatmap legend
const drawHeatmapLegend = (ctx, minDensity, maxDensity) => {
  const legendWidth = 200;
  const legendHeight = 20;
  const legendX = 50;
  const legendY = window.innerHeight - 100;
  
  ctx.save();
  
  // Draw gradient bar
  const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
  gradient.addColorStop(0, 'rgba(0, 0, 255, 0.6)');      // Blue
  gradient.addColorStop(0.25, 'rgba(0, 255, 255, 0.6)'); // Cyan
  gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.6)');    // Green
  gradient.addColorStop(0.75, 'rgba(255, 255, 0, 0.6)'); // Yellow
  gradient.addColorStop(1, 'rgba(255, 0, 0, 0.6)');      // Red
  
  ctx.fillStyle = gradient;
  ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
  
  // Draw border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
  
  // Draw labels
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(`${minDensity.toFixed(2)}`, legendX, legendY - 5);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxDensity.toFixed(2)} agents/m²`, legendX + legendWidth, legendY - 5);
  ctx.textAlign = 'center';
  ctx.fillText('Density Heatmap', legendX + legendWidth / 2, legendY + legendHeight + 20);
  
  ctx.restore();
};

export const drawGridSnapIndicators = (ctx, mousePosition, screenToWorld, worldToScreen, zoom) => {
  if (zoom < 0.5) return;
  
  const worldPos = screenToWorld(mousePosition.x, mousePosition.y);
  const gridSnap = getGridSnapIndicator(worldPos, zoom);
  
  if (!gridSnap) return;
  
  const snapScreen = worldToScreen(gridSnap.x, gridSnap.y);
  const snapRadius = Math.max(4, 6 * Math.min(zoom, 1.5)); // SMALLER: 4-9px instead of 8-18px
  
  ctx.save();
  
  // More subtle colors and smaller indicators
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)'; // Less bright
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';   // More transparent
  ctx.lineWidth = 1.5; // Thinner line
  ctx.setLineDash([]);
  
  // Only show if mouse is close enough
  const distance = Math.sqrt(
    Math.pow(mousePosition.x - snapScreen.x, 2) + 
    Math.pow(mousePosition.y - snapScreen.y, 2)
  );
  
  if (distance <= GRID_SNAP_THRESHOLD) {
    // Subtle pulsing effect
    const pulse = 0.6 + 0.3 * Math.sin(Date.now() * 0.01);
    ctx.globalAlpha = pulse;
    
    // Smaller snap circle
    ctx.beginPath();
    ctx.arc(snapScreen.x, snapScreen.y, snapRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Smaller cross hairs
    const crossSize = snapRadius * 0.4; // Even smaller crosshairs
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(snapScreen.x - crossSize, snapScreen.y);
    ctx.lineTo(snapScreen.x + crossSize, snapScreen.y);
    ctx.moveTo(snapScreen.x, snapScreen.y - crossSize);
    ctx.lineTo(snapScreen.x, snapScreen.y + crossSize);
    ctx.stroke();
  }
  
  ctx.restore();
};

export const drawAngleSnapGuide = (ctx, fromPoint, toPoint, worldToScreen, zoom) => {
  if (zoom < 0.5) return;
  
  const angleSnap = snapToAngle(fromPoint, toPoint, zoom);
  
  if (!angleSnap.snapped) return;
  
  const fromScreen = worldToScreen(fromPoint.x, fromPoint.y);
  const toScreen = worldToScreen(angleSnap.point.x, angleSnap.point.y);
  
  ctx.save();
  
  // Subtle colors
  let color = 'rgba(99, 102, 241, 0.6)';
  if (angleSnap.snapType === 'horizontal') color = 'rgba(16, 185, 129, 0.6)';
  if (angleSnap.snapType === 'vertical') color = 'rgba(59, 130, 246, 0.6)';
  if (angleSnap.snapType === 'diagonal') color = 'rgba(245, 158, 11, 0.6)';
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2; // Thinner line
  ctx.setLineDash([6, 3]); // Shorter dashes
  ctx.globalAlpha = 0.7; // More transparent
  ctx.lineCap = 'round';
  
  // Draw snap line
  ctx.beginPath();
  ctx.moveTo(fromScreen.x, fromScreen.y);
  ctx.lineTo(toScreen.x, toScreen.y);
  ctx.stroke();
  
  // Smaller angle indicator
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = '10px Inter'; // Smaller font
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const midX = (fromScreen.x + toScreen.x) / 2;
  const midY = (fromScreen.y + toScreen.y) / 2;
  
  // Smaller background for text
  const text = `${angleSnap.snapAngle}°`;
  const textWidth = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(midX - textWidth/2 - 3, midY - 6, textWidth + 6, 12); // Smaller background
  
  // Text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, midX, midY);
  
  ctx.restore();
};
