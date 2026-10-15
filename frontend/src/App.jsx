import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/Authentication';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/videoMeet';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/authentication" element={<Authentication />} />
          <Route path='/:url' element ={<VideoMeetComponent/>} /> 
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
