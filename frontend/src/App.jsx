import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/supervisor/DashboardPage';
import TicketListPage from './pages/supervisor/TicketListPage';
import WorklistPage from './pages/agent/WorklistPage';
import TicketDetailPage from './pages/shared/TicketDetailPage';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'supervisor') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tickets" replace />;
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/tickets" element={<PrivateRoute><TicketListPage /></PrivateRoute>} />
        <Route path="/my-tickets" element={<PrivateRoute><WorklistPage /></PrivateRoute>} />
        <Route path="/tickets/:id" element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}