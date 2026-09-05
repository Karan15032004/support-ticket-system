/**
 * DashboardPage.jsx — Supervisor Dashboard (Phase 4)
 *
 * THREE SECTIONS:
 *   1. Stat cards  — 4 headline numbers fetched from GET /dashboard/stats
 *   2. Bar chart   — 8-week resolved trend from GET /dashboard/weekly (Recharts)
 *   3. Agent table — per-agent workload from GET /dashboard/agents
 *
 * DATA FLOW:
 *   Each section fetches independently so a slow query in one section
 *   doesn't block the others from rendering. This is why we have 3 separate
 *   loading states instead of one.
 *
 * DESIGN DECISIONS:
 *   - Stat cards use colored left borders (not background fills) to stay
 *     readable while matching the workspace theme from index.css
 *   - Chart uses the same blue palette as the nav (#2878ff) for consistency
 *   - Agent table highlights agents with 0 tickets so supervisors can
 *     easily spot who has capacity to take more work
 *   - All data refreshes when the page mounts — no manual refresh button needed
 *     since this page is opened intentionally and data doesn't need real-time updates
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SupervisorNav from '../../components/SupervisorNav';
import api from '../../api/axios';

// Recharts components — only import what we use (tree-shaking)
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a number with a comma separator for readability.
 * e.g. 1234 → "1,234"
 * Used in stat cards so large counts are easy to read at a glance.
 */
function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}


// ─── Stat Card Component ──────────────────────────────────────────────────────

/**
 * StatCard — one of the 4 headline number cards at the top of the dashboard.
 *
 * Props:
 *   label      — e.g. "Open Tickets"
 *   value      — the number to display
 *   icon       — emoji for visual scanning (🟢, ⏳, ✅, 🔴)
 *   color      — Tailwind color class for the left border + icon bg
 *   loading    — shows a shimmer placeholder while data is fetching
 *   onClick    — optional: navigates to /tickets with a filter pre-applied
 *   subtitle   — small grey text below the number (optional)
 */
function StatCard({ label, value, icon, borderColor, bgColor, textColor, loading, onClick, subtitle }) {
  return (
    <div
      onClick={onClick}
      className={`workspace-card p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Icon bubble */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>

        {loading ? (
          /* Shimmer placeholder — same height as the number so layout doesn't jump */
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold" style={{ color: textColor }}>
            {formatNumber(value)}
          </p>
        )}

        {subtitle && !loading && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}


// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────

/**
 * CustomTooltip — shown when hovering over a bar in the chart.
 * Recharts passes { active, payload, label } automatically.
 * We use this instead of the default tooltip for consistent styling.
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-bold text-[#2878ff]">
        {payload[0].value} resolved
      </p>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  // ── State: 3 separate data + loading + error states ───────────────────────
  // Each section loads independently — one slow query won't block the others.

  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError,   setStatsError]   = useState('');

  const [weekly,        setWeekly]        = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError,   setWeeklyError]   = useState('');

  const [agents,        setAgents]        = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError,   setAgentsError]   = useState('');

  // ── Fetch stat cards ──────────────────────────────────────────────────────

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch {
        setStatsError('Failed to load stats.');
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, []); // runs once on mount

  // ── Fetch weekly chart data ───────────────────────────────────────────────

  useEffect(() => {
    async function loadWeekly() {
      try {
        const res = await api.get('/dashboard/weekly');
        setWeekly(res.data);
      } catch {
        setWeeklyError('Failed to load chart data.');
      } finally {
        setWeeklyLoading(false);
      }
    }
    loadWeekly();
  }, []);

  // ── Fetch agent workload ──────────────────────────────────────────────────

  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await api.get('/dashboard/agents');
        setAgents(res.data);
      } catch {
        setAgentsError('Failed to load agent data.');
      } finally {
        setAgentsLoading(false);
      }
    }
    loadAgents();
  }, []);

  // ── Chart bar colors ──────────────────────────────────────────────────────
  // We find the highest week and give it a darker blue to make the peak visible.
  // All other bars are a lighter blue. This is a visual design choice that
  // directs attention without needing a legend.

  const maxResolved = Math.max(...weekly.map(w => w.resolved), 0);

  // ── Full render ───────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <SupervisorNav />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle mt-1">
            Welcome back, {user?.name} — here's the live state of your support queue.
          </p>
        </div>

        {/* ── Section 1: Stat cards ────────────────────────────────────────── */}
        {/*
          4 cards in a responsive grid.
          On mobile: 2 columns. On desktop: 4 columns.
          Each card is clickable — takes the supervisor to the tickets page
          with that status pre-filtered so they can act immediately.
        */}
        <section>
          {statsError && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-lg mb-4">
              {statsError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Open Tickets"
              value={stats?.open_count}
              icon="📂"
              borderColor="#2878ff"
              bgColor="#eaf2ff"
              textColor="#1a5fd4"
              loading={statsLoading}
              subtitle="Currently being worked on"
              onClick={() => navigate('/tickets?status=open')}
            />
            <StatCard
              label="Pending"
              value={stats?.pending_count}
              icon="⏳"
              borderColor="#f59e0b"
              bgColor="#fef9ee"
              textColor="#b45309"
              loading={statsLoading}
              subtitle="Waiting on customer reply"
              onClick={() => navigate('/tickets?status=pending')}
            />
            <StatCard
              label="Resolved This Week"
              value={stats?.resolved_this_week}
              icon="✅"
              borderColor="#10b981"
              bgColor="#ecfdf5"
              textColor="#059669"
              loading={statsLoading}
              subtitle="Last 7 days"
              onClick={() => navigate('/tickets?status=resolved')}
            />
            <StatCard
              label="Breaching SLA"
              value={stats?.breaching_now}
              icon="🔴"
              borderColor="#ef4444"
              bgColor="#fef2f2"
              textColor="#dc2626"
              loading={statsLoading}
              subtitle="Require immediate attention"
              onClick={() => navigate('/alerts')}
            />
          </div>
        </section>

        {/* ── Section 2: 8-week bar chart ──────────────────────────────────── */}
        {/*
          Recharts BarChart wrapped in ResponsiveContainer so it resizes with the window.

          WHY ResponsiveContainer?
          BarChart needs explicit width/height. Instead of hardcoding pixels,
          ResponsiveContainer fills the parent div's width automatically.
          height={300} gives the chart a fixed height while width="100%" flexes.

          XAxis: shows the "label" field (e.g. "28 Jul") as the tick text
          YAxis: shows the count. allowDecimals=false since ticket counts are integers.
          Tooltip: our custom component (consistent styling with the rest of the UI)
          Bar: the actual bars, colored by our maxResolved logic above
        */}
        <section className="workspace-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-[#0b1b3a]">Tickets Resolved — Last 8 Weeks</h2>
              <p className="text-xs text-gray-400 mt-0.5">Count of tickets moved to resolved or closed status each week</p>
            </div>
          </div>

          {weeklyError && (
            <p className="text-red-600 text-sm">{weeklyError}</p>
          )}

          {weeklyLoading ? (
            /* Shimmer placeholder the same dimensions as the chart */
            <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : weekly.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">No resolved tickets yet — data will appear as tickets are resolved.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={weekly}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                barCategoryGap="35%"  // gap between bar groups
              >
                {/* Light horizontal grid lines — helps read values */}
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fb" vertical={false} />

                {/* X axis: week start date labels */}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />

                {/* Y axis: resolved count, no decimals */}
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />

                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f6ff' }} />

                <Bar dataKey="resolved" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {/* Color each bar: peak week gets darker blue, rest are lighter */}
                  {weekly.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.resolved === maxResolved && entry.resolved > 0
                        ? '#2878ff'   // peak bar: brand blue
                        : '#93c5fd'   // other bars: lighter blue
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* ── Section 3: Agent workload table ──────────────────────────────── */}
        {/*
          Shows every agent's current open + pending ticket count.
          Supervisors use this to spot overloaded agents and redistribute.

          Sorted by total (open + pending) descending on the backend
          so the busiest agents appear at the top automatically.

          Agents with 0 tickets show a "Available" badge to make
          spare capacity visible at a glance.
        */}
        <section className="workspace-card overflow-hidden">

          {/* Card header */}
          <div className="px-6 py-4 border-b border-[#e5ebf4]">
            <h2 className="text-base font-bold text-[#0b1b3a]">Agent Workload</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Active open and pending tickets per agent — sorted by busiest first
            </p>
          </div>

          {agentsError && (
            <p className="text-red-600 text-sm px-6 py-4">{agentsError}</p>
          )}

          {agentsLoading ? (
            /* Shimmer rows */
            <div className="px-6 py-4 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              No agents found. Add agents to see their workload here.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f3f7fd] border-b border-[#e5ebf4]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Open
                  </th>
                  <th className="hidden sm:table-cell text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
           Pending
         </th>
         <th className="hidden sm:table-cell text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
           Total Active
         </th>
         <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
           Status
         </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf1f7]">
                {agents.map((agent, index) => {
                  const total   = agent.open_count + agent.pending_count;
                  const isEmpty = total === 0;

                  // Color coding: red for very busy, yellow for medium, green/grey for light
                  const totalColor = total >= 10
                    ? 'text-red-600 font-bold'
                    : total >= 5
                      ? 'text-amber-600 font-semibold'
                      : 'text-gray-700';

                  return (
                    <tr key={agent.agent_id} className="hover:bg-[#f8faff] transition-colors">

                      {/* Agent name with avatar initial */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2878ff] to-[#1459df] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {agent.agent_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0b1b3a]">{agent.agent_name}</p>
                            <p className="text-xs text-gray-400">Agent</p>
                          </div>
                        </div>
                      </td>

                      {/* Open count */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${agent.open_count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                          {agent.open_count}
                        </span>
                      </td>

                      {/* Pending count */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${agent.pending_count > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                          {agent.pending_count}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${totalColor}`}>{total}</span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        {isEmpty ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            ✓ Available
                          </span>
                        ) : total >= 10 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            🔴 Overloaded
                          </span>
                        ) : total >= 5 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            ⚠ Busy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ● Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer: summary row */}
              <tfoot>
                <tr className="border-t-2 border-[#dce5f3] bg-[#f8faff]">
                  <td className="px-6 py-3 text-xs font-semibold text-gray-500">
                    {agents.length} agent{agents.length !== 1 ? 's' : ''} total
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-blue-600">
                    {agents.reduce((sum, a) => sum + a.open_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-amber-600">
                    {agents.reduce((sum, a) => sum + a.pending_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                    {agents.reduce((sum, a) => sum + a.open_count + a.pending_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">Total across all agents</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

      </main>
    </div>
  );
}