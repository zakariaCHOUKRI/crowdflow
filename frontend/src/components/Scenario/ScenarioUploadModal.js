import React, { useState } from 'react';
import '../../styles/scenario-upload.css';

const ScenarioUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    author: '',
    category: ''
  });
  const [files, setFiles] = useState({
    jsonFile: null,
    wktFile: null,
    thumbnail: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = process.env.REACT_APP_MONGODB_URI || 'http://localhost:3001/api';

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      author: '',
      category: ''
    });
    setFiles({
      jsonFile: null,
      wktFile: null,
      thumbnail: null
    });
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    setFiles(prev => ({ ...prev, [name]: fileList[0] }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Scenario name is required');
      return false;
    }
    if (!files.jsonFile) {
      setError('JSON configuration file is required');
      return false;
    }
    if (!files.wktFile) {
      setError('WKT geometry file is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const submitFormData = new FormData();
      
      // Add text fields
      Object.keys(formData).forEach(key => {
        submitFormData.append(key, formData[key]);
      });
      
      // Add files
      submitFormData.append('jsonFile', files.jsonFile);
      submitFormData.append('wktFile', files.wktFile);
      if (files.thumbnail) {
        submitFormData.append('thumbnail', files.thumbnail);
      }
      
      const response = await fetch(`${API_BASE}/scenarios`, {
        method: 'POST',
        body: submitFormData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        onSuccess(data.scenario);
        resetForm();
        onClose();
      } else {
        setError(data.error || 'Failed to upload scenario');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error uploading scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="scenario-upload-modal">
        <div className="modal-header">
          <h2>Upload New Scenario</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Scenario Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter scenario name"
                maxLength="100"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your scenario... (optional)"
                maxLength="500"
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="author">Author</label>
              <input
                type="text"
                id="author"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                placeholder="Your name (optional)"
                maxLength="50"
              />
            </div>
          </div>

          {/* Classification */}
          <div className="form-section">
            <h3>Classification</h3>
            
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="e.g., evacuation, crowd-flow, bottleneck..."
                maxLength="50"
              />
            </div>
            
            
          </div>

          {/* Files */}
          <div className="form-section">
            <h3>Files</h3>
            
            <div className="form-group">
              <label htmlFor="jsonFile">JSON Configuration File *</label>
              <input
                type="file"
                id="jsonFile"
                name="jsonFile"
                accept=".json,application/json"
                onChange={handleFileChange}
                required
              />
              <small>The JSON file containing exits, distributions, waypoints, etc.</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="wktFile">WKT Geometry File *</label>
              <input
                type="file"
                id="wktFile"
                name="wktFile"
                accept=".wkt,.txt,text/plain"
                onChange={handleFileChange}
                required
              />
              <small>The WKT file containing walkable areas and obstacles</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="thumbnail">Thumbnail Image</label>
              <input
                type="file"
                id="thumbnail"
                name="thumbnail"
                accept="image/*"
                onChange={handleFileChange}
              />
              <small>Optional: Upload a preview image for your scenario (max 5MB)</small>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Uploading...
                </>
              ) : (
                'Upload Scenario'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScenarioUploadModal;