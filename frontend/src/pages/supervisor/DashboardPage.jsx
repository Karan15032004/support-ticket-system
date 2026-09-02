/**
 * DashboardPage.jsx — Supervisor Dashboard (Placeholder)
 */

import SupervisorNav from '../../components/SupervisorNav';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <SupervisorNav />

      <main className="app-main max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="page-title">
            Welcome back, {user?.name}
          </h1>
          <p className="page-subtitle mt-1">
            Here's what's happening with your support queue.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {['Open Tickets', 'Pending', 'Resolved This Week', 'Breaching SLA'].map((label) => (
            <div key={label} className="workspace-card text-center p-6">
              <div className="text-3xl font-bold text-[#2878ff] mb-1">—</div>
              <div className="text-sm font-medium text-[#64748b]">{label}</div>
            </div>
          ))}
        </div>

        <div className="workspace-card text-center py-16">
          <p className="text-[#7b8da8] text-sm">
            Dashboard stats coming in Phase 4
          </p>
        </div>
      </main>
    </div>
  );
}
