/**
 * App.jsx — Root component: routing + auth context
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/supervisor/DashboardPage';
import TicketListPage   from './pages/supervisor/TicketListPage';
import WorklistPage     from './pages/agent/WorklistPage';
import TicketDetailPage from './pages/shared/TicketDetailPage';
import AlertsPage       from './pages/shared/AlertsPage';
import ArchivedPage     from './pages/shared/ArchivedPage';  // ← NEW

// PrivateRoute: redirects to /login if not authenticated
function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// DefaultRedirect: after login, send user to the right home screen
function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'supervisor') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tickets" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Role-based home redirect */}
      <Route path="/" element={<DefaultRedirect />} />

      {/* Supervisor pages */}
      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />
      <Route path="/tickets" element={
        <PrivateRoute><TicketListPage /></PrivateRoute>
      } />

      {/* Agent pages */}
      <Route path="/my-tickets" element={
        <PrivateRoute><WorklistPage /></PrivateRoute>
      } />

      {/* Shared pages — both roles can access */}
      <Route path="/tickets/:id" element={
        <PrivateRoute><TicketDetailPage /></PrivateRoute>
      } />
      <Route path="/alerts" element={
        <PrivateRoute><AlertsPage /></PrivateRoute>
      } />

      {/* Archived tickets — both supervisor and agent */}
      <Route path="/archived" element={
        <PrivateRoute><ArchivedPage /></PrivateRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}