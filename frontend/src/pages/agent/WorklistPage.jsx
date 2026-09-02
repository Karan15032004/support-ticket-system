import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AgentNav from '../../components/AgentNav';
import CreateTicketModal from '../../components/CreateTicketModal';
import { getTickets } from '../../api/tickets';

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

const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'priority',   label: 'Priority' },
];

function formatLabel(str) {
  return str ? str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function timeAgo(dateStr) {
  const diff    = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorklistPage() {
  const navigate = useNavigate();

  const [tickets,         setTickets]         = useState([]);
  const [totalCount,      setTotalCount]      = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [priority,    setPriority]    = useState('');
  const [category,    setCategory]    = useState('');
  const [sort,        setSort]        = useState('updated_at');
  const [order,       setOrder]       = useState('desc');
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 20;

  // 400ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch on any filter/sort/page change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = { page, page_size: PAGE_SIZE, sort, order };
        if (search)   params.search   = search;
        if (status)   params.status   = status;
        if (priority) params.priority = priority;
        if (category) params.category = category;

        const data = await getTickets(params);
        if (!cancelled) {
          setTickets(data.tickets);
          setTotalCount(data.total_count);
        }
      } catch {
        if (!cancelled) setError('Failed to load your tickets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [search, status, priority, category, sort, order, page]);

  function handleCreated() {
    setPage(1);
    setSearchInput(''); setSearch('');
    setStatus(''); setPriority(''); setCategory('');
  }

  function handleClearFilters() {
    setSearchInput(''); setSearch('');
    setStatus(''); setPriority(''); setCategory('');
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

  const hasFilters = search || status || priority || category;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem  = (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentNav />

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${totalCount} ticket${totalCount !== 1 ? 's' : ''} assigned to you`}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            New Ticket
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search your tickets by subject or description…"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Statuses</option>
            {['new', 'open', 'pending', 'resolved', 'closed'].map(s => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>

          <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Priorities</option>
            {['critical', 'high', 'medium', 'low'].map(p => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>

          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={handleClearFilters} className="text-sm text-emerald-600 hover:text-emerald-800 underline">
              Clear all filters
            </button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 font-medium">Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleSort(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                sort === opt.value
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {sort === opt.value && <span className="ml-1">{order === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <p className="text-sm">Loading your tickets…</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-sm font-medium text-gray-600">
                  {hasFilters ? 'No tickets match these filters' : 'No tickets assigned to you'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {hasFilters ? 'Try clearing the filters' : 'Check back later or ask your supervisor'}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SLA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="hover:bg-emerald-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
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
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Previous
              </button>
              <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
    </div>
  );
}