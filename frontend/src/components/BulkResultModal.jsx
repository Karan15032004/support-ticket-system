/**
 * BulkResultModal.jsx — Shows per-ticket results after a bulk action
 *
 * The assignment explicitly requires bulk actions to return per-ticket results:
 *   [{ticket_id, success: true/false, reason: "..."}]
 *
 * This modal renders that array so the supervisor knows exactly what
 * happened to each ticket — which ones were reassigned/closed and which
 * failed, with the specific reason for each failure.
 *
 * Props:
 *   isOpen   — whether to show the modal
 *   onClose  — callback to close it
 *   results  — array of {ticket_id, success, reason}
 *   title    — e.g. "Bulk Reassign Results"
 */

export default function BulkResultModal({ isOpen, onClose, results = [], title = "Bulk Action Results" }) {
  if (!isOpen) return null;

  const succeeded = results.filter(r => r.success);
  const failed    = results.filter(r => !r.success);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
  className="absolute inset-0 bg-[#061633]/65 backdrop-blur-sm"
  onClick={onClose}/>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col border border-[#dce5f3]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e5ebf4]">
          <h2 className="text-lg font-bold text-[#0b1b3a]">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {succeeded.length} succeeded · {failed.length} failed · {results.length} total
          </p>
        </div>

        {/* Results — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {results.map(r => (
            <div
              key={r.ticket_id}
              className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                r.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <span className="flex-shrink-0 mt-0.5">
                {r.success ? '✅' : '❌'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800">Ticket #{r.ticket_id}</span>
                <p className={`mt-0.5 ${r.success ? 'text-green-700' : 'text-red-700'}`}>
                  {r.reason}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e5ebf4]">
          <button
              onClick={onClose}
              className="btn-primary w-full">
              Done
            </button>
        </div>
      </div>
    </div>
  );
}