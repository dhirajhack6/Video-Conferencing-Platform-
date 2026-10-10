import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/Authentication';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/authentication" element={<Authentication />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
