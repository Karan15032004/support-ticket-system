/**
 * ArchivedPage.jsx — Archived Tickets View
 *
 * BOTH SUPERVISOR and AGENT can view this page:
 *
 *   SUPERVISOR:
 *     - Sees ALL archived tickets
 *     - Can restore any ticket
 *
 *   AGENT:
 *     - Sees ONLY archived tickets where they are the assignee OR collaborator
 *     - Can restore tickets they're assigned to (or collaborating on)
 *
 * CLICKING A TICKET:
 *     Both roles navigate to /tickets/{id} → TicketDetailPage
 *     Detail page loads ALL info: description, replies, events, collaborators, SLA, timeline
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SupervisorNav from '../../components/SupervisorNav';
import AgentNav from '../../components/AgentNav';
import { getTickets, restoreTicket } from '../../api/tickets';

// ─── Constants ──────────────────────────────────────────────────────────────

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

const CATEGORY_OPTIONS = [
  { value: 'billing',         label: 'Billing' },
  { value: 'technical',       label: 'Technical' },
  { value: 'how_to',          label: 'How To' },
  { value: 'account',         label: 'Account' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other',           label: 'Other' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(str) {
  return str ? str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  return new Date(normalized).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArchivedPage() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const isSupervisor = user?.role === 'supervisor';

  const [tickets,    setTickets]    = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [priority,    setPriority]    = useState('');
  const [category,    setCategory]    = useState('');
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 20;

  // Per-row restore loading state
  const [restoringId, setRestoringId] = useState(null);

  // 400ms search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch archived tickets
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = {
          page,
          page_size: PAGE_SIZE,
          sort: 'updated_at',
          order: 'desc',
          include_archived: true,
        };
        if (search)   params.search   = search;
        if (status)   params.status   = status;
        if (priority) params.priority = priority;
        if (category) params.category = category;

        const data = await getTickets(params);
        if (!cancelled) {
          // Filter to archived only (backend might return both)
          const archivedOnly = data.tickets.filter(t => t.archived);
          setTickets(archivedOnly);
          setTotalCount(archivedOnly.length);
        }
      } catch {
        if (!cancelled) setError('Failed to load archived tickets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [search, status, priority, category, page]);

  // ── Restore handler ───────────────────────────────────────────────────────
  // Call backend to restore. If 403, agent doesn't own it. If 200, remove from list.

  async function handleRestore(ticketId) {
    setRestoringId(ticketId);
    try {
      await restoreTicket(ticketId);
      // Success — remove from list (no longer archived)
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setTotalCount(prev => prev - 1);
    } catch (err) {
      // Show backend error message (e.g., 403 "You can only restore tickets assigned to you...")
      alert(err.response?.data?.detail || 'Failed to restore ticket.');
    } finally {
      setRestoringId(null);
    }
  }

  function handleClearFilters() {
    setSearchInput(''); setSearch('');
    setStatus(''); setPriority(''); setCategory('');
    setPage(1);
  }

  const hasFilters = search || status || priority || category;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {isSupervisor ? <SupervisorNav /> : <AgentNav />}

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="page-title">Archived Tickets</h1>
          <p className="page-subtitle mt-1">
            {isSupervisor
              ? 'All archived tickets across the system. Click any ticket to view details, or use the Restore button to return it to the active queue.'
              : 'Your archived tickets. Click any ticket to view full details. Use Restore to return it to your active queue.'}
          </p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search archived tickets by subject or description…"
            className="workspace-input"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="filter-control px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {['new', 'open', 'pending', 'resolved', 'closed'].map(s => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>

          <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}
            className="filter-control px-3 py-2 text-sm">
            <option value="">All Priorities</option>
            {['critical', 'high', 'medium', 'low'].map(p => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>

          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="filter-control px-3 py-2 text-sm">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={handleClearFilters} className="text-sm text-[#1764ed] hover:text-[#1253c7] underline">
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="workspace-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#94a3b8]">
              <p className="text-sm">Loading archived tickets…</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-5xl mb-4">📦</div>
                <p className="text-sm font-semibold text-[#475d7a]">
                  {hasFilters ? 'No archived tickets match these filters' : 'No archived tickets'}
                </p>
                <p className="text-xs text-[#94a3b8] mt-1">
                  {hasFilters
                    ? 'Try clearing the filters'
                    : isSupervisor
                      ? 'Archive a ticket from its detail page to see it here'
                      : 'Tickets archived by your supervisor will appear here'}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f3f7fd] border-b border-[#dce5f3]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Archived</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-amber-50/40 transition-colors group"
                  >
                    {/* Subject — clicking navigates to detail page where user can see all info */}
                    <td
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📦</span>
                        <div>
                          <p className="text-sm font-semibold text-[#0b1b3a] group-hover:text-amber-700 transition-colors line-clamp-1">
                            #{ticket.id} — {ticket.subject}
                          </p>
                          <p className="text-xs text-[#64748b] mt-0.5">
                            {ticket.requester_name} · {formatLabel(ticket.category)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                        {formatLabel(ticket.status)}
                      </span>
                    </td>

                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                        {formatLabel(ticket.priority)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-[#405572] cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      {ticket.assignee?.name ?? <span className="text-[#94a3b8] italic">Unassigned</span>}
                    </td>

                    <td className="px-4 py-3 text-xs text-[#64748b] cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      {formatDate(ticket.updated_at)}
                    </td>

                    {/* Restore button — both supervisors and agents can restore (backend validates ownership) */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRestore(ticket.id)}
                        disabled={restoringId === ticket.id}
                        className="px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        {restoringId === ticket.id ? 'Restoring…' : '📤 Restore'}
                      </button>
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
            <p className="text-sm text-[#64748b]">
              Showing {startItem}–{endItem} of {totalCount} archived ticket{totalCount !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                ← Previous
              </button>
              <span className="text-sm text-[#405572] px-2">Page {page} of {totalPages || 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}