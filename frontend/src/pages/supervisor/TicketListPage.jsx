import { useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import SupervisorNav from '../../components/SupervisorNav';
import CreateTicketModal from '../../components/CreateTicketModal';
import { getTickets } from '../../api/tickets';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high:     'bg-orange-100 text-orange-700 border border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low:      'bg-green-100 text-green-700 border border-green-200',
};

const STATUS_STYLES = {
  new:      'bg-purple-100 text-purple-700',
  open:     'bg-blue-100 text-blue-700',
  pending:  'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed:   'bg-gray-100 text-gray-600',
};

// ─── Pure helper functions (no hooks, defined outside component) ────────────────

const formatLabel = (str) =>
  str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

// ─── Sub-components (defined outside main component) ───────────────────────────

function SLABadge({ seconds }) {
  if (seconds === null || seconds === undefined)
    return <span className="text-gray-400 text-xs">—</span>;
  if (seconds < 0)
    return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Breached</span>;

  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const color = seconds < 3600
    ? 'text-red-600 bg-red-50'
    : seconds < 14400
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-green-600 bg-green-50';

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>
      {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function TicketListPage() {
  const navigate = useNavigate();

  const [tickets,         setTickets]         = useState([]);
  const [totalCount,      setTotalCount]      = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [status,   setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 20;

  // ── The only correct pattern: read state vars directly in useEffect ──────────
  // No useCallback, no function defined outside, no stale closure issues.
  // useEffect re-runs whenever status/priority/page change — that's all we need.
  useEffect(() => {
    let cancelled = false;   // prevents setting state if component unmounts mid-fetch

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = { page, page_size: PAGE_SIZE };
        if (status)   params.status   = status;
        if (priority) params.priority = priority;

        const data = await getTickets(params);

        if (!cancelled) {
          setTickets(data.tickets);
          setTotalCount(data.total_count);
        }
      } catch {
        if (!cancelled) setError('Failed to load tickets. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };   // cleanup on re-render
  }, [status, priority, page]);            // ← plain values, not a function

  // Called by CreateTicketModal after a ticket is created successfully
  // Resets page to 1 and re-triggers the useEffect above
  function handleCreated() {
    setPage(1);       // this triggers useEffect → re-fetches automatically
    setStatus('');
    setPriority('');
  }

  function handleStatusFilter(val)   { setStatus(val);   setPage(1); }
  function handlePriorityFilter(val) { setPriority(val); setPage(1); }
  function handleClearFilters()      { setStatus(''); setPriority(''); setPage(1); }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem  = (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <SupervisorNav />

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading
                ? 'Loading…'
                : `${totalCount} ticket${totalCount !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            New Ticket
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={status}
            onChange={e => handleStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {['new', 'open', 'pending', 'resolved', 'closed'].map(s => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={e => handlePriorityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            {['critical', 'high', 'medium', 'low'].map(p => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>

          {(status || priority) && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-3">⟳</div>
                <p className="text-sm">Loading tickets…</p>
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-medium text-gray-600">No tickets found</p>
                <p className="text-xs text-gray-400 mt-1">
                  {status || priority
                    ? 'Try clearing the filters'
                    : 'Create the first ticket to get started'}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SLA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                        #{ticket.id} — {ticket.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ticket.requester_name} · {formatLabel(ticket.category)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                        {formatLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                        {formatLabel(ticket.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {ticket.assignee?.name ?? (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SLABadge seconds={ticket.sla_remaining_seconds} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {timeAgo(ticket.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && tickets.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Showing {startItem}–{endItem} of {totalCount} tickets
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-600 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
