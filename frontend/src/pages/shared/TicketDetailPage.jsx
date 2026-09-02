
    import { useState, useEffect} from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { useAuth } from '../../context/AuthContext';
    import SupervisorNav from '../../components/SupervisorNav';
    import AgentNav from '../../components/AgentNav';
    import {
    getTicket, getReplies, getEvents, getCollaborators, getAgents,
    addReply, changeStatus, addCollaborator, removeCollaborator,
    } from '../../api/tickets';

    // ─── Constants ──────────────────────────────────────────────────────────────

    const LEGAL_TRANSITIONS = {
    new:      ['open', 'pending'],
    open:     ['pending', 'resolved'],
    pending:  ['open', 'resolved'],
    resolved: ['closed', 'open'],
    closed:   ['open'],
    };

    const STATUS_STYLES = {
    new:      'bg-purple-100 text-purple-700 border border-purple-200',
    open:     'bg-blue-100 text-blue-700 border border-blue-200',
    pending:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
    resolved: 'bg-green-100 text-green-700 border border-green-200',
    closed:   'bg-gray-100 text-gray-600 border border-gray-200',
    };

    const STATUS_BUTTON_STYLES = {
    open:     'bg-blue-600 hover:bg-blue-700 text-white',
    pending:  'bg-yellow-500 hover:bg-yellow-600 text-white',
    resolved: 'bg-green-600 hover:bg-green-700 text-white',
    closed:   'bg-gray-600 hover:bg-gray-700 text-white',
    new:      'bg-purple-600 hover:bg-purple-700 text-white',
    };

    const PRIORITY_STYLES = {
    critical: 'bg-red-100 text-red-700',
    high:     'bg-orange-100 text-orange-700',
    medium:   'bg-yellow-100 text-yellow-700',
    low:      'bg-green-100 text-green-700',
    };

    const EVENT_LABELS = {
    ticket_created:       '🎫 Ticket created',
    status_changed:       '🔄 Status changed',
    reassigned:           '👤 Reassigned',
    reply_added:          '💬 Reply added',
    collaborator_added:   '➕ Collaborator added',
    collaborator_removed: '➖ Collaborator removed',
    ticket_archived:      '📦 Archived',
    ticket_restored:      '📤 Restored',
    };

    // ─── Pure helpers (outside component — no hooks, no re-creation on render) ───

    function formatLabel(str) {
    return str ? str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    }

    function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    }

    // ─── SLA Countdown (FIX: no setState in effect body — use initialSeconds directly) ─

    function SLACountdown({ initialSeconds }) {
    // Start counting from initialSeconds, ticking down every second
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        // Reset offset whenever we get a fresh initialSeconds from the parent
        setOffset(0);
        // Set up the interval to update the offset every second
        const interval = setInterval(() => {
        setOffset(prev => prev + 1);   // increment offset, subtract from initialSeconds
        }, 1000);
        return () => clearInterval(interval);
    }, [initialSeconds]);  // eslint-disable-line react-hooks/exhaustive-deps

    if (initialSeconds === null || initialSeconds === undefined) {
        return <span className="text-gray-400 text-sm">No SLA set</span>;
    }

    const seconds  = initialSeconds - offset;
    const breached = seconds < 0;
    const abs      = Math.abs(seconds);
    const hrs      = Math.floor(abs / 3600);
    const mins     = Math.floor((abs % 3600) / 60);
    const secs     = Math.floor(abs % 60);
    const timeStr  = hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;

    const colorClass = breached
        ? 'text-red-600 bg-red-50 border-red-200'
        : seconds < 3600
        ? 'text-red-500 bg-red-50 border-red-200'
        : seconds < 14400
            ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
            : 'text-green-600 bg-green-50 border-green-200';

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-sm font-medium ${colorClass}`}>
        <span>{breached ? '🔴' : seconds < 3600 ? '🟠' : '🟢'}</span>
        <span>{breached ? `Breached by ${timeStr}` : `${timeStr} remaining`}</span>
        </div>
    );
    }

    // ─── Main Component ──────────────────────────────────────────────────────────

    export default function TicketDetailPage() {
    const { id }      = useParams();
    const navigate    = useNavigate();
    const { user } = useAuth();

    const [ticket,          setTicket]          = useState(null);
    const [replies,         setReplies]         = useState([]);
    const [events,          setEvents]          = useState([]);
    const [collaborators,   setCollaborators]   = useState([]);
    const [agents,          setAgents]          = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [error,           setError]           = useState('');
    const [statusError,     setStatusError]     = useState('');
    const [replyBody,       setReplyBody]       = useState('');
    const [isInternal,      setIsInternal]      = useState(false);
    const [sendingReply,    setSendingReply]    = useState(false);
    const [replyError,      setReplyError]      = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [addingCollab,    setAddingCollab]    = useState(false);
    const [changingStatus,  setChangingStatus]  = useState(false);

    // FIX: loadAll defined BEFORE useEffect so it's in scope when useEffect runs
    async function loadAll() {
        setLoading(true);
        try {
        const [ticketData, repliesData, eventsData, collabData, agentsData] =
            await Promise.all([
            getTicket(id),
            getReplies(id),
            getEvents(id),
            getCollaborators(id),
            getAgents(),
            ]);
        setTicket(ticketData);
        setReplies(repliesData);
        setEvents(eventsData);
        setCollaborators(collabData);
        setAgents(agentsData);
        setError('');
        } catch (err) {
        if (err.response?.status === 404)      setError('Ticket not found.');
        else if (err.response?.status === 403) setError("You don't have access to this ticket.");
        else                                   setError('Failed to load ticket. Please try again.');
        } finally {
        setLoading(false);
        }
    }

    // Now useEffect can safely call loadAll — it's already declared above
    useEffect(() => {
        loadAll();
        const interval = setInterval(loadAll, 60000);
        return () => clearInterval(interval);
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ────────────────────────────────────────────────────────────────

    async function handleStatusChange(newStatus) {
        setChangingStatus(true);
        setStatusError('');
        try {
        const updated = await changeStatus(id, newStatus);
        setTicket(updated);
        const eventsData = await getEvents(id);
        setEvents(eventsData);
        } catch (err) {
        setStatusError(err.response?.data?.detail || 'Status change failed.');
        } finally {
        setChangingStatus(false);
        }
    }

    async function handleSendReply() {
        if (!replyBody.trim()) return;
        setSendingReply(true);
        setReplyError('');
        try {
        const newReply = await addReply(id, { body: replyBody, is_internal: isInternal });
        setReplies(prev => [...prev, newReply]);
        setReplyBody('');
        const eventsData = await getEvents(id);
        setEvents(eventsData);
        } catch (err) {
        setReplyError(err.response?.data?.detail || 'Failed to send reply.');
        } finally {
        setSendingReply(false);
        }
    }

    async function handleAddCollaborator() {
        if (!selectedAgentId) return;
        setAddingCollab(true);
        try {
        await addCollaborator(id, parseInt(selectedAgentId));
        const collabData = await getCollaborators(id);
        setCollaborators(collabData);
        setSelectedAgentId('');
        } catch (err) {
        alert(err.response?.data?.detail || 'Failed to add collaborator.');
        } finally {
        setAddingCollab(false);
        }
    }

    async function handleRemoveCollaborator(agentId) {
        try {
        await removeCollaborator(id, agentId);
        setCollaborators(prev => prev.filter(c => c.agent_id !== agentId));
        } catch (err) {
        alert(err.response?.data?.detail || 'Failed to remove collaborator.');
        }
    }

    // ── Derived values ──────────────────────────────────────────────────────────

    const isSupervisor     = user?.role === 'supervisor';
    const validNextStatuses = LEGAL_TRANSITIONS[ticket?.status] || [];

    const existingAgentIds = new Set([
        ticket?.assignee_id,
        ...collaborators.map(c => c.agent_id),
    ]);
    const availableAgents = agents.filter(a => !existingAgentIds.has(a.id));

    // ── Loading / error states ───────────────────────────────────────────────────

    if (loading) {
        return (
        <div className="app-shell">
            {isSupervisor ? <SupervisorNav /> : <AgentNav />}
            <div className="flex items-center justify-center py-32 text-[#7b8da8]">
            <p>Loading ticket…</p>
            </div>
        </div>
        );
    }

    if (error) {
        return (
        <div className="app-shell">
            {isSupervisor ? <SupervisorNav /> : <AgentNav />}
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-sm text-[#2878ff] hover:text-[#1764ed] underline">
                Go back
            </button>
            </div>
        </div>
        );
    }

    // ── Full render ──────────────────────────────────────────────────────────────

    return (
        <div className="app-shell">
        {isSupervisor ? <SupervisorNav /> : <AgentNav />}

        <main className="app-main max-w-4xl mx-auto px-4 py-8 space-y-6">

            {/* 1. HEADER */}
            <div className="workspace-card p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                <p className="text-xs text-[#7b8da8] mb-1">Ticket #{ticket.id}</p>
                <h1 className="text-xl font-bold text-[#081a3a]">{ticket.subject}</h1>
                </div>
                <span className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[ticket.status]}`}>
                {formatLabel(ticket.status)}
                </span>
            </div>

            {validNextStatuses.length > 0 && (
                <div className="mt-4">
                <p className="text-xs text-[#58708f] mb-2">Move to:</p>
                <div className="flex flex-wrap gap-2">
                    {validNextStatuses.map(s => {
                    if (s === 'closed' && !isSupervisor) return null;
                    return (
                        <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={changingStatus}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${STATUS_BUTTON_STYLES[s]}`}
                        >
                        → {formatLabel(s)}
                        </button>
                    );
                    })}
                </div>
                {statusError && (
                    <p className="text-red-600 text-sm mt-2 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{statusError}</p>
                )}
                </div>
            )}
            </div>

            {/* 2. METADATA */}
            <div className="workspace-card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                <p className="text-xs text-[#58708f] mb-1">Priority</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                    {formatLabel(ticket.priority)}
                </span>
                </div>
                <div>
                <p className="text-xs text-[#58708f] mb-1">Category</p>
                <p className="text-sm text-[#405572] font-medium">{formatLabel(ticket.category)}</p>
                </div>
                <div>
                <p className="text-xs text-[#58708f] mb-1">Requester</p>
                <p className="text-sm text-[#405572] font-medium">{ticket.requester_name}</p>
                </div>
                <div>
                <p className="text-xs text-[#58708f] mb-1">Assignee</p>
                <p className="text-sm text-[#405572] font-medium">
                    {ticket.assignee?.name ?? <span className="text-[#94a3b8] italic">Unassigned</span>}
                </p>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#e5ebf4] flex gap-6 text-xs text-[#7b8da8]">
                <span>Created {formatDate(ticket.created_at)}</span>
                <span>Updated {formatDate(ticket.updated_at)}</span>
            </div>
            </div>

            {/* 3. DESCRIPTION */}
            <div className="workspace-card p-6">
            <h2 className="text-sm font-bold text-[#18345f] mb-3">Description</h2>
            <p className="text-sm text-[#405572] whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>

            {/* 4 + 5. CONVERSATION + REPLY COMPOSER */}
            <div className="workspace-card p-6">
            <h2 className="text-sm font-bold text-[#18345f] mb-4">
                Conversation
                <span className="ml-2 text-[#7b8da8] font-normal">
                ({replies.length} {replies.length === 1 ? 'message' : 'messages'})
                </span>
            </h2>

            {replies.length === 0 ? (
                <p className="text-sm text-[#7b8da8] italic">No replies yet. Be the first to respond.</p>
            ) : (
                <div className="space-y-4">
                {replies.map(reply => (
                    <div
                    key={reply.id}
                    className={`rounded-lg p-4 ${
                        reply.is_internal
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                    >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${reply.is_internal ? 'bg-amber-500' : 'bg-[#2878ff]'}`}>
                            {reply.author.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[#18345f]">{reply.author.name}</span>
                        {reply.is_internal && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
                            Internal note
                            </span>
                        )}
                        </div>
                        <span className="text-xs text-[#7b8da8]">{formatDate(reply.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#405572] whitespace-pre-wrap">{reply.body}</p>
                    </div>
                ))}
                </div>
            )}

            {/* Reply composer */}
            <div className="mt-6 pt-4 border-t border-[#e5ebf4]">
                <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                    type="radio"
                    name="replyType"
                    checked={!isInternal}
                    onChange={() => setIsInternal(false)}
                    className="accent-[#2878ff]"
                    />
                    <span className="text-sm text-[#405572]">Customer reply</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                    type="radio"
                    name="replyType"
                    checked={isInternal}
                    onChange={() => setIsInternal(true)}
                    className="accent-amber-500"
                    />
                    <span className="text-sm text-[#405572]">Internal note</span>
                </label>
                </div>

                <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={isInternal ? 'Write an internal note (only visible to staff)…' : 'Write a reply to the customer…'}
                rows={4}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none transition-colors ${
                    isInternal
                    ? 'bg-amber-50 border-amber-300 focus:ring-amber-400'
                    : 'bg-white border-[#cbd7e8] focus:ring-[#2878ff]'
                }`}
                />

                {replyError && <p className="text-red-600 text-xs mt-1">{replyError}</p>}

                <div className="flex justify-end mt-2">
                <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyBody.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isInternal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2878ff] hover:bg-[#1764ed]'
                    }`}
                >
                    {sendingReply ? 'Sending…' : isInternal ? 'Add Note' : 'Send Reply'}
                </button>
                </div>
            </div>
            </div>

            {/* 6. COLLABORATORS + SLA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="workspace-card p-5">
                <h2 className="text-sm font-bold text-[#18345f] mb-3">Collaborators</h2>

                {collaborators.length === 0 ? (
                <p className="text-sm text-gray-400 italic mb-3">No collaborators yet.</p>
                ) : (
                <ul className="space-y-2 mb-3">
                    {collaborators.map(c => (
                    <li key={c.agent_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                            {c.agent.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#405572]">{c.agent.name}</span>
                        </div>
                        {isSupervisor && (
                        <button
                            onClick={() => handleRemoveCollaborator(c.agent_id)}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                            Remove
                        </button>
                        )}
                    </li>
                    ))}
                </ul>
                )}

                {isSupervisor && availableAgents.length > 0 && (
                <div className="flex gap-2 mt-2">
                    <select
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    className="workspace-select flex-1 px-2 py-1.5 text-sm"
                    >
                    <option value="">Add agent…</option>
                    {availableAgents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                    </select>
                    <button
                    onClick={handleAddCollaborator}
                    disabled={!selectedAgentId || addingCollab}
                    className="btn-primary px-3 py-1.5 disabled:opacity-50"
                    >
                    Add
                    </button>
                </div>
                )}
            </div>

            <div className="workspace-card p-5">
                <h2 className="text-sm font-bold text-[#18345f] mb-3">SLA Status</h2>
                <SLACountdown initialSeconds={ticket.sla_remaining_seconds} />
                {ticket.response_due_at && (
                <p className="text-xs text-[#7b8da8] mt-2">Due: {formatDate(ticket.response_due_at)}</p>
                )}
                <p className="text-xs text-[#7b8da8] mt-1">
                Priority: {formatLabel(ticket.priority)} (
                {{ critical: '1 hour', high: '4 hours', medium: '8 hours', low: '24 hours' }[ticket.priority]}
                {' '}SLA)
                </p>
            </div>
            </div>

            {/* 7. TIMELINE */}
            <div className="workspace-card p-6">
            <h2 className="text-sm font-bold text-[#18345f] mb-4">
                Ticket Timeline
                <span className="ml-2 text-[#7b8da8] font-normal text-xs">(read-only — cannot be edited)</span>
            </h2>

            {events.length === 0 ? (
                <p className="text-sm text-[#7b8da8] italic">No events recorded yet.</p>
            ) : (
                <ol className="relative border-l-2 border-[#cbd8ea]">
                {/* FIX: removed unused `idx` from .map() */}
                {events.map(event => (
                    <li key={event.id} className="ml-4 pb-5">
                    <div className="absolute -left-2.5 mt-0.5 w-4 h-4 rounded-full bg-white border-2 border-[#2878ff] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2878ff]" />
                    </div>
                    <div className="flex items-start justify-between">
                        <div>
                        <p className="text-sm font-semibold text-[#18345f]">
                            {EVENT_LABELS[event.event_type] || formatLabel(event.event_type)}
                        </p>
                        {event.old_value && event.new_value && (
                            <p className="text-xs text-[#58708f] mt-0.5">
                            <span className="line-through text-gray-400">{formatLabel(event.old_value)}</span>
                            {' → '}
                            <span className="font-medium text-[#405572]">{formatLabel(event.new_value)}</span>
                            </p>
                        )}
                        {!event.old_value && event.new_value && (
                            <p className="text-xs text-[#58708f] mt-0.5">{event.new_value}</p>
                        )}
                        <p className="text-xs text-[#7b8da8] mt-0.5">by {event.actor.name}</p>
                        </div>
                        <span className="text-xs text-[#7b8da8] ml-4 whitespace-nowrap">
                        {formatDate(event.created_at)}
                        </span>
                    </div>
                    </li>
                ))}
                </ol>
            )}
            </div>

        </main>
        </div>
    );
    }