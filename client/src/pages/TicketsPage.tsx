import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getTickets } from '../api/tickets';
import { Ticket, TicketStatus, TicketPriority } from '../types/ticket';
import AppLayout from '../components/AppLayout';

const STATUS_CLASSES: Record<TicketStatus, string> = {
  New: 'bg-slate-500/20 text-slate-300',
  Assigned: 'bg-blue-500/20 text-blue-400',
  'In Progress': 'bg-teal-500/20 text-teal-400',
  Escalated: 'bg-orange-500/20 text-orange-400',
  Resolved: 'bg-green-500/20 text-green-400',
  Closed: 'bg-navy-700/60 text-navy-400',
};

const PRIORITY_CLASSES: Record<TicketPriority, string> = {
  Low: 'bg-green-500/20 text-green-400',
  Medium: 'bg-blue-500/20 text-blue-400',
  High: 'bg-orange-500/20 text-orange-400',
  Critical: 'bg-red-500/20 text-red-400',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .catch(() => setError('Failed to load tickets.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
            <p className="text-navy-400 text-sm mt-0.5">
              {isLoading ? '…' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/tickets/new"
            className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            + New Ticket
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && tickets.length === 0 && (
          <div className="text-center py-16 bg-navy-800 border border-navy-700 rounded-lg">
            <p className="text-navy-400 text-sm mb-4">No tickets found.</p>
            <Link
              to="/tickets/new"
              className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
            >
              Create your first ticket
            </Link>
          </div>
        )}

        {/* Table */}
        {!isLoading && tickets.length > 0 && (
          <div className="bg-navy-800 border border-navy-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider hidden md:table-cell">
                    Requester
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider hidden lg:table-cell">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wider hidden lg:table-cell">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    onClick={() => navigate(`/tickets/${ticket._id}`)}
                    className="cursor-pointer hover:bg-navy-700/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-white font-medium truncate max-w-xs">
                        {ticket.title}
                      </p>
                      <p className="text-xs text-navy-500 mt-0.5">{ticket.category}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_CLASSES[ticket.status]
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          PRIORITY_CLASSES[ticket.priority]
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-navy-300 hidden md:table-cell">
                      {ticket.requester.name}
                    </td>
                    <td className="px-4 py-4 text-navy-400 hidden lg:table-cell">
                      {ticket.assignedTo?.name ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-navy-400 hidden lg:table-cell">
                      {formatDate(ticket.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
