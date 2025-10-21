import React from 'react';

export const TrajectoryProgress = ({ 
  trajectoryInfo, 
  onLoadMore, 
  className = '' 
}) => {
  const { 
    totalFrames, 
    loadedFrames, 
    isLoading, 
    hasMore, 
    error 
  } = trajectoryInfo;

  if (totalFrames === 0) return null;

  const progressPercentage = totalFrames > 0 ? (loadedFrames / totalFrames) * 100 : 0;

  return (
    <div className={`trajectory-progress ${className}`} style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontWeight: '500', fontSize: '0.75rem' }}>Animation Data</span>
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          {loadedFrames} / {totalFrames} frames
        </span>
      </div>
      
      <div style={{ width: '100%', height: '4px', background: '#e0e0e0', borderRadius: '2px', marginBottom: '8px' }}>
        <div 
          style={{ 
            height: '100%', 
            background: '#4CAF50', 
            borderRadius: '2px',
            width: `${progressPercentage}%`,
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        )}
        
        {!hasMore && loadedFrames > 0 && (
          <span style={{ color: '#4CAF50', fontSize: '0.75rem' }}>
            ✅ All frames loaded
          </span>
        )}
      </div>
      
      {error && (
        <div style={{ color: '#f44336', fontSize: '0.75rem', marginTop: '4px' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};