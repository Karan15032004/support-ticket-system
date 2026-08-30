/**
 * DashboardPage.jsx — Supervisor Dashboard (Placeholder)
 */

import SupervisorNav from '../../components/SupervisorNav';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <SupervisorNav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Here's what's happening with your support queue.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {['Open Tickets', 'Pending', 'Resolved This Week', 'Breaching SLA'].map((label) => (
            <div key={label} className="card text-center">
              <div className="text-3xl font-bold text-gray-300 mb-1">—</div>
              <div className="text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        <div className="card text-center py-16">
          <p className="text-gray-400 text-sm">
            Dashboard stats coming in Phase 4
          </p>
        </div>
      </main>
    </div>
  );
}