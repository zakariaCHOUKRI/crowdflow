import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import './WelcomePage.css'

// Icon components
const ChevronRight = () => <span className="icon">→</span>
const Play = () => <span className="icon">▶</span>
const Settings = () => <span className="icon">⚙</span>
const Users = () => <span className="icon">👥</span>
const Pencil = () => <span className="icon">✏</span>
const Target = () => <span className="icon">🎯</span>
const Map = () => <span className="icon">🗺</span>
const BarChart = () => <span className="icon">📊</span>
const Zap = () => <span className="icon">⚡</span>
const Shield = () => <span className="icon">🛡</span>
const Download = () => <span className="icon">💾</span>
const ArrowRight = () => <span className="icon">→</span>

function WelcomePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("overview")

  const handleGetStarted = () => {
    localStorage.setItem("jupedsim-welcome-seen", "true")
    navigate("/draw")
  }

  const handleOpenDocs = () => {
    window.open("https://www.jupedsim.org/", "_blank")
  }

  const scrollToContent = () => {
    const contentElement = document.querySelector('.welcome-content');
    if (contentElement) {
        contentElement.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
        });
    }
    };

  return (
    <div className="welcome-container">
         <div className="background-blobs">
    <div className="moving-blob blob-1"></div>
    <div className="moving-blob blob-2"></div>
    <div className="moving-blob blob-3"></div>
    <div className="moving-blob blob-4"></div>
    <div className="moving-blob blob-5"></div>
  </div>
        <nav className="welcome-nav">
  <div className="nav-content">
    <div className="nav-brand">
    <div className="nav-logo">
        <img src="./jupedsim.png" alt="JuPedSim Logo" />
    </div>
    <span>JuPedWeb</span>
    </div>
    <div className="nav-links">
        <button onClick={() => { setActiveTab('overview'); scrollToContent(); }}>Overview</button>
        <button onClick={() => { setActiveTab('features'); scrollToContent(); }}>Features</button>
        <button onClick={() => { setActiveTab('workflow'); scrollToContent(); }}>Workflow</button>
        <button onClick={() => { setActiveTab('models'); scrollToContent(); }}>Models</button>
    </div>
    <div className="nav-actions">
      <button className="nav-btn-secondary" onClick={handleOpenDocs}>JuPedSim Docs</button>
      <button className="nav-btn-primary" onClick={handleGetStarted}>Get Started</button>
    </div>
  </div>
</nav>
      <div className="welcome-hero">
        <div className="hero-content">
          <div className="logo-section">
            <h1 className="hero-title">Web Based JuPedSim</h1>
            <p className="hero-subtitle">
              Democratizing Scenario Modeling and Simulations for Pedestrian Dynamics
            </p>
          </div>
          
          <div className="hero-actions">
            <button className="btn btn-hero-primary" onClick={handleGetStarted}>
              Start Simulation
              <ChevronRight />
            </button>
            <button className="btn btn-hero-secondary" onClick={handleOpenDocs}>
              Documentation
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="simulation-preview">
  <div className="preview-background">
    <div className="moving-blob blob-1"></div>
    <div className="moving-blob blob-2"></div>
    <div className="moving-blob blob-3"></div>
  </div>
  <div className="preview-elements">
  <div className="preview-distribution">
    <div className="area-border"></div>
    <div className="distribution-label">Start</div>
  </div>
  <div className="preview-exit">
    <div className="area-border"></div>
    <div className="exit-label">Exit</div>
  </div>
  <div className="preview-agents">
    <div className="agent agent-1"></div>
    <div className="agent agent-2"></div>
    <div className="agent agent-3"></div>
    <div className="agent agent-4"></div>
    <div className="agent agent-5"></div>
  </div>
</div>
</div>
        </div>
      </div>

      <div className="welcome-content">
        <div className="content-tabs">
          <div className="tabs-nav">
            <button 
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
              onClick={() => setActiveTab('features')}
            >
              Features
            </button>
            <button 
              className={`tab-button ${activeTab === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              Workflow
            </button>
            <button 
              className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
              onClick={() => setActiveTab('models')}
            >
              Models
            </button>
          </div>

          <div className="tab-content-area">
            {activeTab === 'overview' && (
              <div className="tab-panel">
                <div className="section-header">
                  <h2>What is JuPedSim?</h2>
                  <p>JuPedSim is a powerful framework for simulating pedestrian dynamics and crowd behavior with scientific precision.</p>
                </div>

                <div className="overview-grid">
                  <div className="overview-card">
                    <div className="card-icon research">
                      <BarChart />
                    </div>
                    <h3>Research-Grade</h3>
                    <p>Built on validated models used in academic research and real-world applications for over a decade.</p>
                  </div>
                  
                  <div className="overview-card">
                    <div className="card-icon performance">
                      <Zap />
                    </div>
                    <h3>High Performance</h3>
                    <p>C++ core with Python interface optimized for large-scale simulations with thousands of agents.</p>
                  </div>
                  
                  <div className="overview-card">
                    <div className="card-icon accessible">
                      <Map />
                    </div>
                    <h3>Web Accessible</h3>
                    <p>No installation required. Run complex pedestrian simulations directly in your browser.</p>
                  </div>
                </div>

                <div className="applications-section">
                  <h3>Applications</h3>
                  <div className="applications-grid">
                    <div className="application-item">
                      <Shield />
                      <span>Emergency Evacuation Planning</span>
                    </div>
                    <div className="application-item">
                      <Users />
                      <span>Crowd Management</span>
                    </div>
                    <div className="application-item">
                      <Map />
                      <span>Urban Design</span>
                    </div>
                    <div className="application-item">
                      <Settings />
                      <span>Infrastructure Planning</span>
                    </div>
                    <div className="application-item">
                      <BarChart />
                      <span>Performance Analysis</span>
                    </div>
                    <div className="application-item">
                      <Target />
                      <span>Safety Assessment</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="tab-panel">
                <div className="section-header">
                  <h2>Platform Features</h2>
                  <p>Everything you need for comprehensive pedestrian dynamics simulation.</p>
                </div>

                <div className="features-grid">
                  <div className="feature-card primary">
                    <div className="feature-header">
                      <Pencil />
                      <h3>Interactive Drawing Tools</h3>
                    </div>
                    <ul>
                      <li>Draw boundaries and walkable areas</li>
                      <li>Place exits and entry points</li>
                      <li>Add obstacles and barriers</li>
                      <li>Create waypoints for routing</li>
                    </ul>
                  </div>

                  <div className="feature-card secondary">
                    <div className="feature-header">
                      <Play />
                      <h3>Real-time Simulation</h3>
                    </div>
                    <ul>
                      <li>Live visualization of agent movement</li>
                      <li>Adjustable playback speed</li>
                      <li>Frame-by-frame analysis</li>
                      <li>Agent trail visualization</li>
                    </ul>
                  </div>

                  <div className="feature-card accent">
                    <div className="feature-header">
                      <Settings />
                      <h3>Advanced Configuration</h3>
                    </div>
                    <ul>
                      <li>Multiple pedestrian models</li>
                      <li>Customizable agent parameters</li>
                      <li>Flow-based spawning</li>
                      <li>Journey routing systems</li>
                    </ul>
                  </div>

                  <div className="feature-card success">
                    <div className="feature-header">
                      <BarChart />
                      <h3>Data Export</h3>
                    </div>
                    <ul>
                      <li>SQLite trajectory databases</li>
                      <li>Statistical analysis data</li>
                      <li>Scenario configurations</li>
                      <li>Multi-seed batch runs</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workflow' && (
              <div className="tab-panel">
                <div className="section-header">
                  <h2>Simulation Workflow</h2>
                  <p>Follow these steps to create and run your pedestrian simulation.</p>
                </div>

                <div className="workflow-steps">
                  <div className="workflow-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h3>Design Environment</h3>
                      <p>Draw walkable boundaries, add obstacles, and define the physical space where pedestrians will move.</p>
                      <div className="step-tools">
                        <span className="tool-tag">Boundary Tool</span>
                        <span className="tool-tag">Obstacle Tool</span>
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h3>Configure Entry & Exit Points</h3>
                      <p>Place distribution areas where agents spawn and exits where they're trying to reach.</p>
                      <div className="step-tools">
                        <span className="tool-tag">Start Area Tool</span>
                        <span className="tool-tag">Exit Tool</span>
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h3>Set Agent Parameters</h3>
                      <p>Configure the number of agents, their physical properties, and movement characteristics.</p>
                      <div className="step-tools">
                        <span className="tool-tag">Agent Count</span>
                        <span className="tool-tag">Movement Speed</span>
                        <span className="tool-tag">Body Radius</span>
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h3>Define Journeys (Optional)</h3>
                      <p>Create complex routing patterns using waypoints to guide agent movement through the environment.</p>
                      <div className="step-tools">
                        <span className="tool-tag">Waypoint Tool</span>
                        <span className="tool-tag">Journey Editor</span>
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step">
                    <div className="step-number">5</div>
                    <div className="step-content">
                      <h3>Run & Analyze</h3>
                      <p>Execute the simulation, visualize results in real-time, and export data for further analysis.</p>
                      <div className="step-tools">
                        <span className="tool-tag">Simulation Controls</span>
                        <span className="tool-tag">Data Export</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'models' && (
              <div className="tab-panel">
                <div className="section-header">
                  <h2>Pedestrian Models</h2>
                  <p>Choose from scientifically validated models for different simulation scenarios.</p>
                </div>

                <div className="models-grid">
                  <div className="model-card speed">
                    <div className="model-header">
                      <div className="model-indicator"></div>
                      <h3>Collision Free Speed Model</h3>
                    </div>
                    <p className="model-description">
                      Velocity-based model ideal for normal pedestrian flow. Agents adjust speed to avoid collisions while maintaining natural movement patterns.
                    </p>
                    <div className="model-features">
                      <span className="feature-tag">Fast Performance</span>
                      <span className="feature-tag">Open Spaces</span>
                    </div>
                  </div>

                  <div className="model-card force">
                    <div className="model-header">
                      <div className="model-indicator"></div>
                      <h3>Social Force Model</h3>
                    </div>
                    <p className="model-description">
                      Physics-based model simulating social forces between pedestrians. Excellent for realistic crowd dynamics and personal space behavior.
                    </p>
                    <div className="model-features">
                      <span className="feature-tag">Realistic Behavior</span>
                      <span className="feature-tag">Social Interactions</span>
                    </div>
                  </div>

                  <div className="model-card centrifugal">
                    <div className="model-header">
                      <div className="model-indicator"></div>
                      <h3>Generalized Centrifugal Force</h3>
                    </div>
                    <p className="model-description">
                      Advanced force model with repulsive interactions. Perfect for high-density scenarios and emergency evacuation simulations.
                    </p>
                    <div className="model-features">
                      <span className="feature-tag">High Density</span>
                      <span className="feature-tag">Emergency Scenarios</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="welcome-footer">
        <div className="footer-content">
          <div className="footer-info">
            <h4>Ready to get started?</h4>
            <p>Begin creating your pedestrian simulation in minutes.</p>
          </div>
          <div className="footer-actions">
            <button className="btn btn-footer-secondary" onClick={handleOpenDocs}>
              View Documentation
            </button>
            <button className="btn btn-footer-primary" onClick={handleGetStarted}>
              Launch Simulator
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage