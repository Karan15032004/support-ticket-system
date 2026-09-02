import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SupervisorNav from '../../components/SupervisorNav';
import CreateTicketModal from '../../components/CreateTicketModal';
import BulkResultModal from '../../components/BulkResultModal';
import {
  getTickets, getAgents, bulkAssign, bulkClose, exportCSV,
} from '../../api/tickets';

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

const CATEGORY_OPTIONS = [
  { value: 'billing',         label: 'Billing' },
  { value: 'technical',       label: 'Technical' },
  { value: 'how_to',          label: 'How To' },
  { value: 'account',         label: 'Account' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other',           label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'priority',   label: 'Priority' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatLabel = (str) =>
  str ? str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

// Backend stores timestamps as UTC but currently serializes them
// without a timezone suffix. Explicitly mark timezone-less timestamps as UTC
// before JavaScript parses them, otherwise the browser treats them as IST.
const timeAgo = (dateStr) => {
  if (!dateStr) return 'just now';

  const normalizedDate = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr)
    ? dateStr
    : `${dateStr}Z`;

  const diff = Math.max(0, Date.now() - new Date(normalizedDate).getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

// ─── SLA Badge ─────────────────────────────────────────────────────────────────

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

  // Data
  const [tickets,         setTickets]         = useState([]);
  const [totalCount,      setTotalCount]      = useState(0);
  const [agents,          setAgents]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters — each a separate useState to match the useEffect dependency pattern
  const [searchInput, setSearchInput] = useState('');  // what user types
  const [search,      setSearch]      = useState('');  // debounced value sent to API
  const [status,      setStatus]      = useState('');
  const [priority,    setPriority]    = useState('');
  const [category,    setCategory]    = useState('');
  const [assigneeId,  setAssigneeId]  = useState('');
  const [sort,        setSort]        = useState('updated_at');
  const [order,       setOrder]       = useState('desc');
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 20;

  // Bulk action state
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [bulkAction,      setBulkAction]      = useState('');
  const [bulkAssignAgent, setBulkAssignAgent] = useState('');
  const [bulkLoading,     setBulkLoading]     = useState(false);
  const [bulkResults,     setBulkResults]     = useState(null);
  const [showBulkModal,   setShowBulkModal]   = useState(false);

  // ── 400ms debounce on search input ────────────────────────────────────────
  // WHY DEBOUNCE?
  // Without it, every keystroke fires an API call. With 400ms delay, we wait
  // until the user pauses typing and fire ONE call. This prevents hammering
  // the backend while the user is mid-word.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Load agents list once on mount ────────────────────────────────────────
  useEffect(() => {
    getAgents().then(setAgents).catch(() => {});
  }, []);

  // ── Fetch tickets whenever any filter/sort/page changes ───────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = { page, page_size: PAGE_SIZE, sort, order };
        if (search)     params.search      = search;
        if (status)     params.status      = status;
        if (priority)   params.priority    = priority;
        if (category)   params.category    = category;
        if (assigneeId) params.assignee_id = assigneeId;

        const data = await getTickets(params);
        if (!cancelled) {
          setTickets(data.tickets);
          setTotalCount(data.total_count);
          setSelectedIds(new Set()); // clear selection on new results
        }
      } catch {
        if (!cancelled) setError('Failed to load tickets. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [search, status, priority, category, assigneeId, sort, order, page]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreated() {
    setPage(1);
    setSearchInput(''); setSearch('');
    setStatus(''); setPriority(''); setCategory(''); setAssigneeId('');
  }

  function handleClearFilters() {
    setSearchInput(''); setSearch('');
    setStatus(''); setPriority(''); setCategory(''); setAssigneeId('');
    setSort('updated_at'); setOrder('desc');
    setPage(1);
  }

  function toggleSort(field) {
    if (sort === field) {
      setOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  }

  // ── Checkbox selection ────────────────────────────────────────────────────

  function toggleTicket(ticketId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(ticketId) ? next.delete(ticketId) : next.add(ticketId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map(t => t.id)));
    }
  }

  // ── Bulk action execution ─────────────────────────────────────────────────

  async function executeBulkAction() {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      let result;

      if (bulkAction === 'assign') {
        if (!bulkAssignAgent) return;
        result = await bulkAssign(ids, parseInt(bulkAssignAgent));
      } else if (bulkAction === 'close') {
        result = await bulkClose(ids);
      }

      setBulkResults(result);
      setShowBulkModal(true);

      // Re-fetch to reflect changes
      const params = { page, page_size: PAGE_SIZE, sort, order };
      if (search)     params.search      = search;
      if (status)     params.status      = status;
      if (priority)   params.priority    = priority;
      if (category)   params.category    = category;
      if (assigneeId) params.assignee_id = assigneeId;
      const data = await getTickets(params);
      setTickets(data.tickets);
      setTotalCount(data.total_count);
      setSelectedIds(new Set());
      setBulkAction('');
      setBulkAssignAgent('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Bulk action failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  async function handleExportCSV() {
    try {
      const params = { sort, order };
      if (search)     params.search      = search;
      if (status)     params.status      = status;
      if (priority)   params.priority    = priority;
      if (category)   params.category    = category;
      if (assigneeId) params.assignee_id = assigneeId;

      const blob = await exportCSV(params);

      // Standard browser pattern for triggering a file download from JS
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'tickets_export.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export CSV.');
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasFilters = search || status || priority || category || assigneeId;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem  = (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <SupervisorNav />

      <main className="app-main max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">All Tickets</h1>
            <p className="page-subtitle mt-1">
              {loading ? 'Loading…' : `${totalCount} ticket${totalCount !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="btn-secondary"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <span className="text-lg leading-none">+</span>
              New Ticket
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search tickets by subject or description…"
            className="workspace-input"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
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

          <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); setPage(1); }}
            className="filter-control px-3 py-2 text-sm">
            <option value="">All Assignees</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={handleClearFilters} className="text-sm text-[#1764ed] hover:text-[#1253c7] underline">
              Clear all filters
            </button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[#58708f] font-semibold">Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleSort(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                sort === opt.value
                  ? 'bg-[#eaf2ff] border-[#8db5ff] text-[#1764ed] font-medium'
                  : 'border-[#dce5f3] text-[#64748b] hover:bg-[#f3f7fd] hover:text-[#18345f]'
              }`}
            >
              {opt.label}
              {sort === opt.value && <span className="ml-1">{order === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
        </div>

        {/* Bulk action bar — shown only when tickets are selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[#eaf2ff] border border-[#c9dcff] rounded-xl">
            <span className="text-sm font-semibold text-[#174ea6]">
              {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''} selected
            </span>

            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className="filter-control px-3 py-1.5 text-sm">
              <option value="">Choose action…</option>
              <option value="assign">Reassign</option>
              <option value="close">Close</option>
            </select>

            {bulkAction === 'assign' && (
              <select value={bulkAssignAgent} onChange={e => setBulkAssignAgent(e.target.value)}
                className="filter-control px-3 py-1.5 text-sm">
                <option value="">Select agent…</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={executeBulkAction}
              disabled={bulkLoading || !bulkAction || (bulkAction === 'assign' && !bulkAssignAgent)}
              className="btn-primary px-4 py-1.5"
            >
              {bulkLoading ? 'Processing…' : 'Apply'}
            </button>

            <button
              onClick={() => { setSelectedIds(new Set()); setBulkAction(''); setBulkAssignAgent(''); }}
              className="text-sm text-[#1764ed] hover:text-[#1253c7] underline ml-auto"
            >
              Deselect all
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="workspace-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#94a3b8]">
              <div className="text-center">
                <div className="text-4xl mb-3">⟳</div>
                <p className="text-sm">Loading tickets…</p>
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-semibold text-[#475d7a]">No tickets found</p>
                <p className="text-xs text-[#94a3b8] mt-1">
                  {hasFilters ? 'Try clearing the filters' : 'Create the first ticket to get started'}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f3f7fd] border-b border-[#dce5f3]">
                  <th className="text-left px-4 py-3 w-10">
                    {/* Select-all checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.size === tickets.length && tickets.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 accent-[#2878ff]"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">SLA</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[#58708f] uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-[#f3f7ff] cursor-pointer transition-colors group ${
                      selectedIds.has(ticket.id) ? 'bg-[#eaf2ff]/70' : ''
                    }`}
                  >
                    {/* Checkbox cell — stopPropagation prevents row click nav */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ticket.id)}
                        onChange={() => toggleTicket(ticket.id)}
                        className="rounded border-gray-300 accent-[#2878ff]"
                      />
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <p className="text-sm font-semibold text-[#0b1b3a] group-hover:text-[#1764ed] transition-colors line-clamp-1">
                        #{ticket.id} — {ticket.subject}
                      </p>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {ticket.requester_name} · {formatLabel(ticket.category)}
                      </p>
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                        {formatLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                        {formatLabel(ticket.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#405572]" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      {ticket.assignee?.name ?? <span className="text-[#94a3b8] italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <SLABadge seconds={ticket.sla_remaining_seconds} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748b]" onClick={() => navigate(`/tickets/${ticket.id}`)}>
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
            <p className="text-sm text-[#64748b]">
              Showing {startItem}–{endItem} of {totalCount} tickets
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                ← Previous
              </button>
              <span className="text-sm text-[#405572] px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}
      </main>

      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      <BulkResultModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        results={bulkResults?.results || []}
        title={bulkAction === 'assign' ? 'Bulk Reassign Results' : 'Bulk Close Results'}
      />
    </div>
  );
}