/**
 * WorklistPage.jsx — Agent's "My Tickets" page (Placeholder)
 */

import AgentNav from '../../components/AgentNav';
import { useAuth } from '../../context/AuthContext';

export default function WorklistPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentNav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tickets assigned to you or where you're a collaborator.
          </p>
        </div>

        <div className="card text-center py-16">
          <p className="text-gray-400 text-sm">
            Your ticket list will appear here — coming in Phase 2
          </p>
        </div>
      </main>
    </div>
  );
}