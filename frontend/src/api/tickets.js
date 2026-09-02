/**
 * api/tickets.js — All ticket-related API calls
 *
 * Phase 2: getTickets, getTicket, createTicket, updateTicket, changeStatus,
 *          getReplies, addReply, getEvents, getCollaborators, addCollaborator,
 *          removeCollaborator, getAgents
 *
 * Phase 3 additions: bulkAssign, bulkClose, exportCSV, archiveTicket, restoreTicket
 */

import api from './axios';

// ─── Tickets ──────────────────────────────────────────────────────────────────

/**
 * Get paginated + filtered + sorted list of tickets.
 * params can include:
 *   page, page_size, status, priority, category, assignee_id,
 *   search, sort (created_at|updated_at|priority), order (asc|desc)
 * Axios serialises this object into a query string automatically.
 */
export const getTickets = (params = {}) =>
  api.get('/tickets', { params }).then(r => r.data);

export const getTicket = (id) =>
  api.get(`/tickets/${id}`).then(r => r.data);

export const createTicket = (data) =>
  api.post('/tickets', data).then(r => r.data);

export const updateTicket = (id, data) =>
  api.put(`/tickets/${id}`, data).then(r => r.data);

export const changeStatus = (id, new_status) =>
  api.put(`/tickets/${id}/status`, { new_status }).then(r => r.data);

// ─── Replies ──────────────────────────────────────────────────────────────────

export const getReplies = (ticketId) =>
  api.get(`/tickets/${ticketId}/replies`).then(r => r.data);

export const addReply = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/replies`, data).then(r => r.data);

// ─── Timeline ─────────────────────────────────────────────────────────────────

export const getEvents = (ticketId) =>
  api.get(`/tickets/${ticketId}/events`).then(r => r.data);

// ─── Collaborators ────────────────────────────────────────────────────────────

export const getCollaborators = (ticketId) =>
  api.get(`/tickets/${ticketId}/collaborators`).then(r => r.data);

export const addCollaborator = (ticketId, agentId) =>
  api.post(`/tickets/${ticketId}/collaborators`, { agent_id: agentId }).then(r => r.data);

export const removeCollaborator = (ticketId, agentId) =>
  api.delete(`/tickets/${ticketId}/collaborators/${agentId}`);

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const getAgents = () =>
  api.get('/tickets/meta/agents').then(r => r.data);

// ─── Bulk Actions (Phase 3) ───────────────────────────────────────────────────

/**
 * Bulk reassign multiple tickets to one agent.
 * Returns { results: [{ticket_id, success, reason}] }
 */
export const bulkAssign = (ticketIds, assigneeId) =>
  api.post('/tickets/bulk-assign', {
    ticket_ids: ticketIds,
    assignee_id: assigneeId,
  }).then(r => r.data);

/**
 * Bulk close multiple tickets.
 * Returns { results: [{ticket_id, success, reason}] }
 */
export const bulkClose = (ticketIds) =>
  api.post('/tickets/bulk-close', {
    ticket_ids: ticketIds,
  }).then(r => r.data);

/**
 * Export currently-filtered tickets as a CSV file download.
 * params = same filter params as getTickets (no page/page_size — exports all)
 *
 * WHY responseType: 'blob'?
 * CSV is a binary file, not JSON. axios defaults to parsing responses as text/JSON.
 * 'blob' tells axios to return raw binary data so we can create a download link.
 */
export const exportCSV = (params = {}) =>
  api.get('/tickets/export', {
    params,
    responseType: 'blob',
  }).then(r => r.data);

// ─── Archive / Restore (Phase 3) ─────────────────────────────────────────────

/**
 * Archive a ticket (soft delete — hidden from queues, data preserved).
 * Supervisor only.
 */
export const archiveTicket = (id) =>
  api.put(`/tickets/${id}/archive`).then(r => r.data);

/**
 * Restore an archived ticket back to active queue.
 * Supervisor only.
 */
export const restoreTicket = (id) =>
  api.put(`/tickets/${id}/restore`).then(r => r.data);