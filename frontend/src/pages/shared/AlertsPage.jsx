/**
 * AlertsPage.jsx — SLA Alerts Page
 *
 * Shared between supervisor and agent, behaviour differs by role:
 *
 * SUPERVISOR:
 *   - Sees ALL breaching/about-to-breach tickets across the system
 *   - Cards are read-only — no acknowledge button
 *   - Clicking a card navigates to that ticket
 *
 * AGENT:
 *   - Sees ONLY their own tickets that are breaching/about-to-breach
 *   - Each card has an Acknowledge button to dismiss the alert
 *   - Acknowledged alerts disappear immediately (optimistic update)
 *   - If the ticket is later reopened and breaches again, it reappears
 *
 * The backend handles all role filtering — this component just calls
 * GET /alerts and renders whatever comes back.
 *
 * CARD COLOURS:
 *   Red    → severity="red"    → already breached (remaining < 0)
 *   Yellow → severity="yellow" → within 1 hour (0 < remaining < 3600)
 *
 * WHY NO useCallback?
 * We define fetchAlerts as a plain async function inside useEffect.
 * This avoids the React exhaustive-deps lint warning that appears when
 * useCallback(() => {...}, []) is listed as a useEffect dependency —
 * the linter correctly warns that the empty dep array means the callback
 * is recreated once but the effect sees a stable reference forever.
 * Plain function inside useEffect is cleaner and warning-free.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SupervisorNav from '../../components/SupervisorNav';
import AgentNav from '../../components/AgentNav';
import api from '../../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(seconds) {
  const abs  = Math.abs(seconds);
  const hrs  = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = Math.floor(abs % 60);
  if (hrs > 0)  return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const PRIORITY_STYLES = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-green-100 text-green-700',
};

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, isSupervisor, onAcknowledge, acknowledging }) {
  const navigate   = useNavigate();
  const isBreached = alert.severity === 'red';

  const cardStyle = isBreached
    ? 'border-red-300 bg-red-50'
    : 'border-yellow-300 bg-yellow-50';

  const badgeStyle = isBreached
    ? 'bg-red-100 text-red-700 border border-red-200'
    : 'bg-yellow-100 text-yellow-700 border border-yellow-200';

  return (
    <div className={`rounded-xl border p-5 ${cardStyle} flex items-start justify-between gap-4`}>

      {/* Left: ticket info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {isBreached ? '🔴 Breached' : '🟡 Warning'}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_STYLES[alert.priority] || 'bg-gray-100 text-gray-600'}`}>
            {formatLabel(alert.priority)}
          </span>
        </div>

        {/* Subject — clickable, navigates to ticket detail */}
        <button
          onClick={() => navigate(`/tickets/${alert.ticket_id}`)}
          className="text-left text-sm font-semibold text-gray-900 hover:text-blue-700 hover:underline transition-colors line-clamp-2 mt-1"
        >
          #{alert.ticket_id} — {alert.subject}
        </button>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span>Status: {formatLabel(alert.status)}</span>
          {alert.assignee_name && <span>· Assignee: {alert.assignee_name}</span>}
        </div>

        <p className={`mt-2 text-sm font-medium ${isBreached ? 'text-red-700' : 'text-yellow-700'}`}>
          {isBreached
            ? `Overdue by ${formatTime(alert.sla_remaining_seconds)}`
            : `${formatTime(alert.sla_remaining_seconds)} until breach`}
        </p>
      </div>

      {/* Right: acknowledge button (agents only — supervisors just read) */}
      {!isSupervisor && (
        <button
          onClick={() => onAcknowledge(alert.ticket_id)}
          disabled={acknowledging === alert.ticket_id}
          className="flex-shrink-0 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {acknowledging === alert.ticket_id ? 'Acknowledging…' : '✓ Acknowledge'}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { user }     = useAuth();
  const isSupervisor = user?.role === 'supervisor';

  const [alerts,        setAlerts]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [acknowledging, setAcknowledging] = useState(null);

  // ── Fetch alerts ────────────────────────────────────────────────────────────
  // FIX: plain function inside useEffect instead of useCallback.
  // useCallback with [] deps + [fetchAlerts] in useEffect deps causes
  // the React exhaustive-deps lint warning. This pattern is clean and warning-free.

  useEffect(() => {
    let cancelled = false;

    async function fetchAlerts() {
      setError('');
      try {
        const res = await api.get('/alerts');
        if (!cancelled) setAlerts(res.data);
      } catch {
        if (!cancelled) setError('Failed to load alerts. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAlerts();

    // Re-fetch every 60 seconds so the page stays live without a manual refresh
    const interval = setInterval(fetchAlerts, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // empty deps = run once on mount, cleanup on unmount

  // ── Acknowledge handler ──────────────────────────────────────────────────────

  async function handleAcknowledge(ticketId) {
    setAcknowledging(ticketId);
    try {
      await api.post(`/alerts/${ticketId}/acknowledge`);
      // Optimistic update: remove the card immediately without waiting for refetch
      setAlerts(prev => prev.filter(a => a.ticket_id !== ticketId));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to acknowledge alert.');
    } finally {
      setAcknowledging(null);
    }
  }

  // ── Split by severity ────────────────────────────────────────────────────────

  const redAlerts    = alerts.filter(a => a.severity === 'red');
  const yellowAlerts = alerts.filter(a => a.severity === 'yellow');

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {isSupervisor ? <SupervisorNav /> : <AgentNav />}

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSupervisor ? 'SLA Alerts' : 'My SLA Alerts'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSupervisor
              ? 'All tickets that are breaching or about to breach their SLA target.'
              : 'Your tickets that need attention. Acknowledge to dismiss an alert.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <p className="text-sm">Loading alerts…</p>
          </div>

        ) : alerts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-base font-semibold text-gray-700">All clear!</p>
              <p className="text-sm text-gray-400 mt-1">
                {isSupervisor
                  ? 'No tickets are breaching or about to breach SLA right now.'
                  : 'None of your tickets are breaching SLA right now.'}
              </p>
            </div>
          </div>

        ) : (
          <div className="space-y-8">

            {/* RED — already breached */}
            {redAlerts.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-semibold text-red-700">🔴 Already Breached</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {redAlerts.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {redAlerts.map(alert => (
                    <AlertCard
                      key={alert.ticket_id}
                      alert={alert}
                      isSupervisor={isSupervisor}
                      onAcknowledge={handleAcknowledge}
                      acknowledging={acknowledging}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* YELLOW — about to breach */}
            {yellowAlerts.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-semibold text-yellow-700">🟡 About to Breach</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    {yellowAlerts.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {yellowAlerts.map(alert => (
                    <AlertCard
                      key={alert.ticket_id}
                      alert={alert}
                      isSupervisor={isSupervisor}
                      onAcknowledge={handleAcknowledge}
                      acknowledging={acknowledging}
                    />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </main>
    </div>
  );
}