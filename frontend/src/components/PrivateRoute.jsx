/**
 * PrivateRoute.jsx — Route Protection Component
 *
 * FIX: Changed from <Outlet /> to {children}
 *
 * App.jsx uses the children pattern:
 *   <PrivateRoute><DashboardPage /></PrivateRoute>
 *
 * <Outlet /> only works with nested route pattern:
 *   <Route element={<PrivateRoute />}>
 *     <Route path="/dashboard" element={<DashboardPage />} />
 *   </Route>
 *
 * Since App.jsx passes children, PrivateRoute must render {children}.
 * Mixing the two patterns causes the "Router inside Router" crash.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}