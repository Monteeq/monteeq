import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { Zap, Crown } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PageSkeleton } from './components/Skeleton';

const Home = React.lazy(() => import('./pages/Home'));
const Landing = React.lazy(() => import('./pages/Landing'));
const Flash = React.lazy(() => import('./pages/Flash'));
const Posts = React.lazy(() => import('./pages/Posts'));
const Upload = React.lazy(() => import('./pages/Upload'));
const Chat = React.lazy(() => import('./pages/Chat'));
const CreatePost = React.lazy(() => import('./pages/CreatePost'));

const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Watch = React.lazy(() => import('./pages/Watch'));
const Verify = React.lazy(() => import('./pages/Verify'));

const Search = React.lazy(() => import('./pages/Search'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ManageContent = React.lazy(() => import('./pages/ManageContent'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
const Insights = React.lazy(() => import('./pages/Insights'));
const Performance = React.lazy(() => import('./pages/Performance'));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const PartnerV2 = React.lazy(() => import('./pages/PartnerV2'));
const Challenges = React.lazy(() => import('./pages/Challenges'));
const About = React.lazy(() => import('./pages/About'));
const JoinPro = React.lazy(() => import('./pages/JoinProV2'));
const AdminPortal = React.lazy(() => import('./pages/AdminPortal'));
const Privacy = React.lazy(() => import('./pages/Privacy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const PaymentCallback = React.lazy(() => import('./pages/PaymentCallback'));
const NotFound = React.lazy(() => import('./pages/NotFound'));


import NotificationManager from './components/NotificationManager';
import Sidebar from './components/Sidebar';
import ModernHeader from './components/ModernHeader';
import Footer from './components/Footer';
import MeshBackground from './components/MeshBackground';
import ErrorBoundary from './components/ErrorBoundary';
import { ErrorProvider } from './context/ErrorContext';
import './index.css';


const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, loading, user } = useAuth();
  if (loading) return null; 
  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return children;
};


function AppContent() {
  const { user, logout, token } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isFlashPage = location.pathname === '/flash';
  const isHomePage = location.pathname === '/home';
  const isOnboardingPage = location.pathname === '/onboarding';
  const isLandingPage = location.pathname === '/' && !token;
  
  // Immersive pages hide everything
  const isAuthPage = ['/login', '/signup', '/verify', '/forgot-password', '/reset-password'].includes(location.pathname);
  const isMarketingPage = ['/about', '/partner', '/privacy', '/terms'].includes(location.pathname);
  const isPaymentPage = location.pathname === '/payment';
  
  const knownPaths = [
    '/', '/home', '/login', '/signup', '/verify', '/forgot-password', '/reset-password',
    '/about', '/partner', '/pro', '/privacy', '/terms', '/payment',
    '/flash', '/search', '/settings', '/posts', '/create-post', '/upload', '/chat',
    '/manage', '/manage-videos', '/achievements', '/notifications',
    '/insights', '/performance', '/onboarding', '/challenges',
    '/admin'

  ];
  const isDynamicPath = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/profile/');
  const isNotFound = !knownPaths.includes(location.pathname) && !isDynamicPath;

  const isImmersive = isAuthPage || isFlashPage || isPaymentPage || isNotFound;
  const hideSidebar = isLandingPage || isImmersive || isMarketingPage;
  const hideHeader = isImmersive || isLandingPage;

  // Auto-logout when backend returns 401
  React.useEffect(() => {
    const handler = () => logout();
    window.addEventListener('monteeq:session-expired', handler);
    return () => window.removeEventListener('monteeq:session-expired', handler);
  }, [logout]);

  // Redirection guard (Onboarding & Verification)
  React.useEffect(() => {
    if (token && user) {
      if (!user.is_verified && location.pathname !== '/verify') {
        navigate('/verify');
      } else if (user.is_verified && !user.is_onboarded && location.pathname !== '/onboarding' && location.pathname !== '/verify') {
        navigate('/onboarding');
      }
    }
  }, [token, user, location.pathname, navigate]);

  return (
    <div className="app-container">
      <MeshBackground />
      {!hideHeader && (
        <ModernHeader
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          isMenuOpen={isMenuOpen}
        />
      )}
      <div className={hideSidebar ? "app-layout-fullscreen" : "app-layout"}>
        {!hideSidebar && <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}
        <main className={hideSidebar ? "landing-page-main" : `main-stage ${isFlashPage ? 'no-padding' : ''}`}>
          <div className={hideSidebar ? "content-wrapper-fullscreen" : "content-wrapper"} style={hideSidebar ? { minHeight: '100%', display: 'flex' } : {
            display: 'flex',
            gap: '2rem',
            width: '100%',
            flexWrap: 'wrap'
          }}>
            <div style={hideSidebar ? { width: '100%', minHeight: '100%' } : { flex: 1, minWidth: '300px' }}>
              <React.Suspense fallback={<PageSkeleton />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={token ? <Navigate to="/home" replace /> : <Landing />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/flash" element={<Flash />} />
                  <Route path="/watch/:id" element={<Watch />} />

                  <Route path="/login" element={token ? <Navigate to="/home" replace /> : <Login />} />
                  <Route path="/signup" element={token ? <Navigate to="/home" replace /> : <Signup />} />
                  <Route path="/forgot-password" element={token ? <Navigate to="/home" replace /> : <ForgotPassword />} />
                  <Route path="/reset-password" element={token ? <Navigate to="/home" replace /> : <ResetPassword />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/partner" element={<PartnerV2 />} />
                  <Route path="/payment" element={<PaymentCallback />} />
                  
                  {/* Protected App Routes */}
                  <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                  <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
                  <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
                  <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                  <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/manage" element={<ProtectedRoute><ManageContent /></ProtectedRoute>} />
                  <Route path="/manage-videos" element={<ProtectedRoute><ManageContent /></ProtectedRoute>} />
                  <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
                  <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
                  
                  {/* Protected Context Routings */}
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
                  <Route path="/challenges" element={<Challenges />} />
                  <Route path="/pro" element={<ProtectedRoute><JoinPro /></ProtectedRoute>} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPortal /></ProtectedRoute>} />

                  {/* 404 catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                {!isImmersive && <Footer />}
              </React.Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <ErrorProvider>
              <ErrorBoundary>
                <NotificationManager />
                <AppContent />
              </ErrorBoundary>
            </ErrorProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
