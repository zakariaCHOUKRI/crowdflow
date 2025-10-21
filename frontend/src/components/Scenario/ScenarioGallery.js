import React, { useState, useEffect } from 'react';
import '../../styles/scenario-gallery.css';

const ScenarioGallery = ({ isOpen, onClose, onLoadScenario }) => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [likedScenarios, setLikedScenarios] = useState(new Set());
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    sortBy: 'newest'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    hasNext: false,
    hasPrev: false
  });

  const API_BASE = process.env.REACT_APP_MONGODB_URI || 'http://localhost:3001/api';

  const fetchScenarios = async (page = 1) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...filters
      });
      
      const response = await fetch(`${API_BASE}/scenarios?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setScenarios(data.scenarios);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Failed to fetch scenarios');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScenarios();
    }
  }, [isOpen, filters]);

  const handleLoadScenario = async (scenarioId, scenarioName) => {
    try {
      // Download scenario data
      const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/download`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Pass the scenario data to parent component
        onLoadScenario(data.jsonConfig, data.wktGeometry, scenarioName);
        onClose();
      } else {
        setError(data.error || 'Failed to load scenario');
      }
    } catch (err) {
      setError('Failed to load scenario');
      console.error('Error loading scenario:', err);
    }
  };

  const handleLikeScenario = async (scenarioId, currentLikes) => {
    try {
      const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Update local state
        setScenarios(prev => prev.map(scenario => 
          scenario._id === scenarioId 
            ? { ...scenario, stats: { ...scenario.stats, likes: data.likes } }
            : scenario
        ));
      }
    } catch (err) {
      console.error('Error liking scenario:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  if (!isOpen) return null;

  return (
    <div className="scenario-gallery-overlay">
      <div className="scenario-gallery">
        <div className="scenario-gallery-header">
          <h2>Scenario Gallery</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* Filters */}
        <div className="gallery-filters">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search scenarios..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
            {/* placeholder="Search by category..."
              value={filters.category === 'all' ? '' : filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value || 'all')}
              className="search-input" */}
          </div>
          
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search by category..."
              value={filters.category === 'all' ? '' : filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value || 'all')}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popular">Most Popular</option>
              <option value="likes">Most Liked</option>
            </select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Loading State */}
        {/* {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading scenarios...</p>
          </div>
        )} */}

        {/* Scenarios Grid */}
        {!loading && scenarios.length > 0 && (
          <div className="scenarios-grid">
            {scenarios.map((scenario) => (
              <div key={scenario._id} className="scenario-card">
                <div className="scenario-thumbnail">
                  {scenario.thumbnail ? (
                    <img 
                      src={`${API_BASE}/scenarios/thumbnails/${scenario.thumbnail}`}
                      alt={scenario.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="thumbnail-placeholder" style={{ display: scenario.thumbnail ? 'none' : 'flex' }}>
                    <span>📐</span>
                  </div>
                  
                  <div className="scenario-overlay">
                    <button 
                      className="load-button"
                      onClick={() => handleLoadScenario(scenario._id, scenario.name)}
                    >
                      Load Scenario
                    </button>
                  </div>
                </div>
                
                <div className="scenario-info">
                  <h3 className="scenario-title">{scenario.name}</h3>
                  <p className="scenario-description">{scenario.description}</p>
                  
                  <div className="scenario-meta">
                    <span className="scenario-category">{scenario.metadata.category}</span>
                  </div>
                  
             
                  
                  <div className="scenario-stats">
                    <span className="stat">
                      <span className="stat-icon">⬇️</span>
                      {scenario.stats.downloads}
                    </span>
                    <button 
                      className="stat stat-button"
                      onClick={() => handleLikeScenario(scenario._id, scenario.stats.likes)}
                    >
                      <span className="stat-icon">❤️</span>
                      {scenario.stats.likes}
                    </button>
                  </div>
                  
                  <div className="scenario-author">
                    By {scenario.metadata.author}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && scenarios.length === 0 && !error && (
          <div className="empty-state">
            <p>No scenarios found matching your filters.</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && scenarios.length > 0 && (
          <div className="pagination">
            <button 
              onClick={() => fetchScenarios(pagination.current - 1)}
              disabled={!pagination.hasPrev}
              className="pagination-button"
            >
              Previous
            </button>
            
            <span className="pagination-info">
              Page {pagination.current} of {pagination.total}
            </span>
            
            <button 
              onClick={() => fetchScenarios(pagination.current + 1)}
              disabled={!pagination.hasNext}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioGallery;