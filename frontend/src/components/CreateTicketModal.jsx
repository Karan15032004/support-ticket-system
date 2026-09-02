/**
 * CreateTicketModal.jsx — Modal form to create a new support ticket
 *
 * HOW MODALS WORK HERE:
 * The parent page (TicketListPage) controls whether this modal is visible
 * by passing an `isOpen` prop. When the user submits or closes,
 * we call the `onClose` and `onCreated` callbacks to tell the parent.
 *
 * PROPS:
 *   isOpen    — boolean, controls visibility
 *   onClose   — function to call when user cancels or closes
 *   onCreated — function to call after successful creation (refreshes the list)
 *
 * STATE IN THIS COMPONENT:
 *   form    — the form field values
 *   agents  — list of agents fetched from API (for assignee dropdown)
 *   loading — true while submitting (disables the button to prevent double-submit)
 *   error   — error message to show if API call fails
 */

import { useState, useEffect } from 'react';
import { createTicket, getAgents } from '../api/tickets';

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const CATEGORIES = ['billing', 'technical', 'how_to', 'account', 'feature_request', 'other'];

// Converts "how_to" → "How To", "feature_request" → "Feature Request"
const formatLabel = (str) =>
  str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Maps priority to a color for the badge preview
const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export default function CreateTicketModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    requester_name: '',
    priority: 'medium',
    category: 'technical',
    assignee_id: '',
  });
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch agents when modal opens (for the assignee dropdown)
  useEffect(() => {
    if (isOpen) {
      getAgents()
        .then(setAgents)
        .catch(() => setAgents([]));
    }
  }, [isOpen]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.subject.trim()) return setError('Subject is required');
    if (!form.description.trim()) return setError('Description is required');
    if (!form.requester_name.trim()) return setError('Requester name is required');

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id ? parseInt(form.assignee_id) : null,
      };
      await createTicket(payload);
      onCreated();

      // Reset form here instead of in useEffect
      setForm({
        subject: '',
        description: '',
        requester_name: '',
        priority: 'medium',
        category: 'technical',
        assignee_id: '',
      });
      setError('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    // Overlay: dark navy semi-transparent background with a subtle blur
    // Clicking the overlay closes the modal (good UX)
    <div
      className="fixed inset-0 bg-[#061633]/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal box */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#dce5f3]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e5ebf4]">
          <h2 className="text-xl font-bold text-[#0b1b3a]">
            New Support Ticket
          </h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#18345f] transition-colors text-2xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[#405572] mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              placeholder="Brief description of the issue"
              className="workspace-input"
            />
          </div>

          {/* Requester Name */}
          <div>
            <label className="block text-sm font-medium text-[#405572] mb-1">
              Requester Name <span className="text-red-500">*</span>
            </label>
            <input
              name="requester_name"
              value={form.requester_name}
              onChange={handleChange}
              placeholder="Customer's name"
              className="workspace-input"
            />
          </div>

          {/* Priority + Category side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#405572] mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="workspace-select"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{formatLabel(p)}</option>
                ))}
              </select>

              {/* Live preview of the priority badge */}
              <span
                className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[form.priority]}`}
              >
                {formatLabel(form.priority)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#405572] mb-1">
                Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="workspace-select"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{formatLabel(c)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee dropdown */}
          <div>
            <label className="block text-sm font-medium text-[#405572] mb-1">
              Assign To <span className="text-[#94a3b8] font-normal">(optional)</span>
            </label>
            <select
              name="assignee_id"
              value={form.assignee_id}
              onChange={handleChange}
              className="workspace-select"
            >
              <option value="">Unassigned</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#405572] mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Detailed description of the issue..."
              rows={4}
              className="workspace-textarea resize-none"
            />
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e5ebf4]">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
