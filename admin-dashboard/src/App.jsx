import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './Dashboard';

import StatsDetail from './StatsDetail';
import AdminChallenges from './AdminChallenges';
import PartnerLeads from './PartnerLeads';
import ErrorBoundary from './ErrorBoundary';
import NotFound from './NotFound';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider, useToast } from './context/ToastContext';

function AppContent() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [theme, setTheme] = useState(localStorage.getItem('adminTheme') || 'light');
  const { showError } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e) => {
      const msg = e.detail?.message || 'An API error occurred.';
      showError(msg);
    };
    window.addEventListener('admin:api-error', handler);
    return () => window.removeEventListener('admin:api-error', handler);
  }, [showError]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={!token ? <AdminLogin setToken={setToken} /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={token ? <Dashboard token={token} setToken={setToken} theme={theme} toggleTheme={toggleTheme} /> : <Navigate to="/" />} />

        <Route path="/challenges" element={token ? <Dashboard token={token} setToken={setToken} theme={theme} toggleTheme={toggleTheme} initialTab="Challenges" /> : <Navigate to="/" />} />
        <Route path="/partners" element={token ? <Dashboard token={token} setToken={setToken} theme={theme} toggleTheme={toggleTheme} initialTab="Featured Creators" /> : <Navigate to="/" />} />
        <Route path="/stats/:metric" element={token ? <Dashboard token={token} setToken={setToken} theme={theme} toggleTheme={toggleTheme} initialTab="Analytics" /> : <Navigate to="/" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ToastProvider>
    </NotificationProvider>
  );
}
