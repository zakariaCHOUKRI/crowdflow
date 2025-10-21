import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import OfflineApp from './offlineApp';
import PerformanceMonitor from './components/PerformanceMonitor';
import WelcomePage from './WelcomePage';
// import OnlineApp from './onlineApp'; 


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/draw" element={<OfflineApp />} />
        {/* <Route path="/live" element={<OnlineApp />} /> */}
        <Route path="/performance" element={<PerformanceMonitor />} />
      </Routes>
    </Router>
  );
}



export default App;