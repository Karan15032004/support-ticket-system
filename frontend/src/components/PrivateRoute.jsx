/**
 * PrivateRoute.jsx — Route Protection Component
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ role }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    if (user.role === 'supervisor') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/my-tickets" replace />;
    }
  }

  return <Outlet />;
}