import React, { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { subscribeAuth, loadSession } from './services/localApi';
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import ChatInterface from "./components/ChatInterface";
const TeacherJoeAvatar = lazy(() => import('./pages/TeacherJoeAvatar'));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [showModel, setShowModel] = useState(false);

  // Check authentication state on mount and persist
  useEffect(() => {
    const unsubscribe = subscribeAuth((user) => {
      setIsAuthenticated(!!user);
    });
    loadSession().catch(() => setSessionError('Cannot connect to Career Compass. Check that the Docker app and database are healthy, then retry.')).finally(() => setLoading(false));

    return () => unsubscribe();
  }, []);
  if (sessionError) return <div className="screen-loading"><p role="alert">{sessionError}</p><button className="button" onClick={() => window.location.reload()}>Retry connection</button></div>;

  // Function to toggle between chat and model views
  const toggleModelView = (shouldShow) => {
    setShowModel(shouldShow);
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="screen-loading" role="status"><p>Opening Career Compass...</p><div className="loading-bars" aria-hidden="true"><span /><span /></div></div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={<LandingPage onAuthSuccess={() => setIsAuthenticated(true)} />}
          />
          <Route
            path="/chat"
            element={
              isAuthenticated ? (
                <div className="main-layout">
                  <div hidden={showModel}><ChatInterface onToggleView={toggleModelView} /></div>
                  {showModel && <Suspense fallback={<div className="screen-loading" role="status">Opening voice studio...</div>}><TeacherJoeAvatar onToggleView={toggleModelView} /></Suspense>}
                </div>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={isAuthenticated ? "/chat" : "/"} replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
