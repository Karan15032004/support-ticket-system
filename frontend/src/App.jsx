/**
 * App.jsx — Route Configuration
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/supervisor/DashboardPage';
import WorklistPage from './pages/agent/WorklistPage';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'supervisor') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tickets" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RoleRedirect />} />

      <Route element={<PrivateRoute role="supervisor" />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route element={<PrivateRoute role="agent" />}>
        <Route path="/my-tickets" element={<WorklistPage />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}