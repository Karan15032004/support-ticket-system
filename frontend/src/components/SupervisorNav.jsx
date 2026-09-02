/**
 * SupervisorNav.jsx — Navigation bar for Supervisors
 *
 * Phase 2 addition: Bell icon now shows a live red badge with the count
 * of tickets that are breaching or about to breach SLA (within 1 hour).
 *
 * HOW THE BADGE WORKS:
 *   1. On mount, fetch GET /alerts/count from the backend
 *   2. Store the count in state
 *   3. Re-fetch every 60 seconds (so the badge stays fresh without a page reload)
 *   4. If count > 0, show a red circle with the number over the bell icon
 *   5. If count > 9, show "9+" to avoid the badge getting too wide
 *
 * The backend already filters by role — supervisors get the count
 * across ALL tickets. Agents (AgentNav) get only their own tickets.
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function SupervisorNav() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  // Fetch alert count on mount, then refresh every 60 seconds
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await api.get('/alerts/count');
        setAlertCount(res.data.count);
      } catch {
        // Silently fail — badge just stays at 0
        // Don't show error UI for a background count fetch
      }
    }

    fetchCount();                                    // fetch immediately on mount
    const interval = setInterval(fetchCount, 60000); // then every 60 seconds
    return () => clearInterval(interval);            // cleanup on unmount
  }, []);

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between h-16 shadow-sm">

      {/* Left: Logo + role badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">ST</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm">
          Support Tickets
        </span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          Supervisor
        </span>
      </div>

      {/* Centre: Nav links */}
      <div className="flex items-center gap-1">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          Tickets
        </NavLink>
      </div>

      {/* Right: Bell icon + name + logout */}
      <div className="flex items-center gap-3">

        {/* Bell icon with red badge */}
        <NavLink
          to="/alerts"
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="SLA Alerts"
        >
          {/* Bell SVG */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Red badge — only shown when count > 0 */}
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </NavLink>

        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
        </div>

        <button
          onClick={logout}
          className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}