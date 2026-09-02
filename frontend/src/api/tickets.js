/**
 * api/tickets.js — All ticket-related API calls
 *
 * WHY A SEPARATE API FILE?
 * Instead of writing fetch/axios calls directly inside components,
 * we centralise them here. Benefits:
 *   1. If the API URL changes, you change it in ONE place
 *   2. Components stay clean — they call getTickets(), not axios.get('/tickets?page=1&...')
 *   3. Easy to find all backend interactions in one file
 *
 * All functions here:
 *   - Use the axios instance from api/axios.js (which auto-adds the JWT token)
 *   - Return the data directly (axios wraps responses in .data automatically)
 *   - Let errors bubble up — the calling component handles them
 */

import api from './axios';

// ─────────────────────────────────────────────
// Tickets
// ─────────────────────────────────────────────

/**
 * Get a paginated list of tickets.
 * params is an object like: { page: 1, page_size: 20, status: 'open', priority: 'high' }
 * Axios converts this object into query string: ?page=1&page_size=20&status=open&priority=high
 */
export const getTickets = (params = {}) =>
  api.get('/tickets', { params }).then(r => r.data);

/**
 * Get a single ticket by ID.
 * Returns the full ticket object including sla_remaining_seconds.
 */
export const getTicket = (id) =>
  api.get(`/tickets/${id}`).then(r => r.data);

/**
 * Create a new ticket.
 * data = { subject, description, requester_name, priority, category, assignee_id }
 */
export const createTicket = (data) =>
  api.post('/tickets', data).then(r => r.data);

/**
 * Update ticket fields (subject, description, etc.)
 * Only include the fields you want to change.
 * data = { subject: "New title" }  — only subject updates, rest unchanged
 */
export const updateTicket = (id, data) =>
  api.put(`/tickets/${id}`, data).then(r => r.data);

/**
 * Change ticket status.
 * data = { new_status: "open" }
 * The server validates whether this transition is legal.
 */
export const changeStatus = (id, new_status) =>
  api.put(`/tickets/${id}/status`, { new_status }).then(r => r.data);

// ─────────────────────────────────────────────
// Replies
// ─────────────────────────────────────────────

/**
 * Get all replies for a ticket, in chronological order.
 */
export const getReplies = (ticketId) =>
  api.get(`/tickets/${ticketId}/replies`).then(r => r.data);

/**
 * Add a reply to a ticket.
 * data = { body: "Hello", is_internal: false }
 * is_internal: false = customer reply (white background)
 *              true  = internal note (amber background)
 */
export const addReply = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/replies`, data).then(r => r.data);

// ─────────────────────────────────────────────
// Timeline (immutable events)
// ─────────────────────────────────────────────

/**
 * Get the full immutable event timeline for a ticket.
 * Returns every status change, reply, reassignment, etc. ever recorded.
 */
export const getEvents = (ticketId) =>
  api.get(`/tickets/${ticketId}/events`).then(r => r.data);

// ─────────────────────────────────────────────
// Collaborators
// ─────────────────────────────────────────────

/**
 * Get all collaborators on a ticket.
 */
export const getCollaborators = (ticketId) =>
  api.get(`/tickets/${ticketId}/collaborators`).then(r => r.data);

/**
 * Add an agent as a collaborator.
 * data = { agent_id: 5 }
 */
export const addCollaborator = (ticketId, agentId) =>
  api.post(`/tickets/${ticketId}/collaborators`, { agent_id: agentId }).then(r => r.data);

/**
 * Remove a collaborator from a ticket.
 * DELETE returns 204 No Content — no response body.
 */
export const removeCollaborator = (ticketId, agentId) =>
  api.delete(`/tickets/${ticketId}/collaborators/${agentId}`);

// ─────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────

/**
 * Get list of all active agents (for dropdowns).
 * Used when creating/editing tickets and adding collaborators.
 */
export const getAgents = () =>
  api.get('/tickets/meta/agents').then(r => r.data);