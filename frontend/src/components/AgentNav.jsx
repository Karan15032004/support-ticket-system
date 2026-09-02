/**
 * AgentNav.jsx — Navigation bar for Agents
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
        // Badge stays at 0
      }
    }

    fetchCount();

    const interval = setInterval(fetchCount, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="bg-white border-b border-[#dce5f3] px-6 flex items-center justify-between h-16 shadow-[0_2px_12px_rgba(15,35,75,0.05)]">

      {/* Logo */}
      <div className="flex items-center gap-3">

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2878ff] to-[#1459df] flex items-center justify-center shadow-md">
          <span className="text-white text-sm font-bold">
            ST
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-[#0b1b3a] text-sm">
            SupportHub
          </span>

          <span className="text-[11px] bg-[#eaf2ff] text-[#1764ed] border border-[#c9dcff] px-2 py-0.5 rounded-full font-semibold">
            Agent
          </span>
        </div>

      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">

        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isActive
                ? 'bg-[#eaf2ff] text-[#1764ed] shadow-sm'
                : 'text-[#64748b] hover:bg-[#f3f7fd] hover:text-[#0b1b3a]'
            }`
          }
        >
          My Tickets
        </NavLink>

      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">

        <NavLink
          to="/alerts"
          className="relative p-2 text-[#64748b] hover:text-[#1764ed] hover:bg-[#f3f7fd] rounded-lg transition-colors"
          title="My SLA Alerts"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </NavLink>

        <div className="text-right">
          <p className="text-sm font-semibold text-[#0b1b3a]">
            {user?.name}
          </p>
          <p className="text-[11px] text-[#7b8da8]">
            Agent
          </p>
        </div>

        <button
          onClick={logout}
          className="px-3 py-2 text-sm text-[#64748b] hover:text-[#dc2626] hover:bg-red-50 rounded-lg transition-colors font-semibold"
        >
          Logout
        </button>

      </div>
    </nav>
  );
}