/**
 * AgentNav.jsx — Navigation bar for Agents
 *
 * Phase 2 addition: Same bell badge as SupervisorNav, but the backend
 * automatically filters to only count THIS agent's breaching tickets.
 * The frontend code is identical — the role filtering happens server-side.
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function AgentNav() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await api.get('/alerts/count');
        setAlertCount(res.data.count);
      } catch {
        // Silently fail — badge stays at 0
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between h-16 shadow-sm">

      {/* Left: Logo + role badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">ST</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm">
          Support Tickets
        </span>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
          Agent
        </span>
      </div>

      {/* Centre: Nav links */}
      <div className="flex items-center gap-1">
        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          My Tickets
        </NavLink>
      </div>

      {/* Right: Bell icon + name + logout */}
      <div className="flex items-center gap-3">

        {/* Bell icon with red badge */}
        <NavLink
          to="/alerts"
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="My SLA Alerts"
        >
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