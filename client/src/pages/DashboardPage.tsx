import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getDashboard } from '../api/dashboard';
import { DashboardData } from '../types/dashboard';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
} from '../types/ticket';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import AppLayout from '../components/AppLayout';

const ROLE_LABELS: Record<UserRole, string> = {
  requester: 'Requester',
  support_agent: 'Support Agent',
  admin: 'Admin',
};

const STATUS_BAR_CLASSES: Record<TicketStatus, string> = {
  New: 'bg-slate-400',
  Assigned: 'bg-blue-400',
  'In Progress': 'bg-teal-400',
  Escalated: 'bg-orange-400',
  Resolved: 'bg-green-400',
  Closed: 'bg-navy-600',
};

const STATUS_TEXT_CLASSES: Record<TicketStatus, string> = {
  New: 'bg-slate-500/20 text-slate-300',
  Assigned: 'bg-blue-500/20 text-blue-400',
  'In Progress': 'bg-teal-500/20 text-teal-400',
  Escalated: 'bg-orange-500/20 text-orange-400',
  Resolved: 'bg-green-500/20 text-green-400',
  Closed: 'bg-navy-700/60 text-navy-400',
};

const PRIORITY_BAR_CLASSES: Record<TicketPriority, string> = {
  Low: 'bg-green-400',
  Medium: 'bg-blue-400',
  High: 'bg-orange-400',
  Critical: 'bg-red-400',
};

const PRIORITY_TEXT_CLASSES: Record<TicketPriority, string> = {
  Low: 'bg-green-500/20 text-green-400',
  Medium: 'bg-blue-500/20 text-blue-400',
  High: 'bg-orange-500/20 text-orange-400',
  Critical: 'bg-red-500/20 text-red-400',
};

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Failed to load dashboard data.';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(extractMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-navy-400 text-sm mt-1">
            Welcome back,{' '}
            <span className="text-navy-300 font-medium">{user?.name}</span>
            {user && (
              <span className="ml-2 text-xs text-navy-500">· {ROLE_LABELS[user.role]}</span>
            )}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* ── Metric cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-1">Total Tickets</p>
                <p className="text-3xl font-bold text-teal-400">{data.totalTickets}</p>
              </div>
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-1">Open</p>
                <p className="text-3xl font-bold text-blue-400">{data.openTickets}</p>
              </div>
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-1">Resolved</p>
                <p className="text-3xl font-bold text-green-400">{data.resolvedTickets}</p>
              </div>
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-1">Critical</p>
                <p className="text-3xl font-bold text-red-400">{data.criticalTickets}</p>
              </div>
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-1">High Priority</p>
                <p className="text-3xl font-bold text-orange-400">{data.highPriorityTickets}</p>
              </div>
            </div>

            {/* ── Breakdowns ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {/* By Status */}
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
                  By Status
                </h2>
                <div className="space-y-3">
                  {TICKET_STATUSES.map((status) => {
                    const count = data.ticketsByStatus[status] ?? 0;
                    const width = pct(count, data.totalTickets);
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-navy-300">{status}</span>
                          <span className="text-navy-400 tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${STATUS_BAR_CLASSES[status]}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Priority */}
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
                  By Priority
                </h2>
                <div className="space-y-3">
                  {TICKET_PRIORITIES.map((priority) => {
                    const count = data.ticketsByPriority[priority] ?? 0;
                    const width = pct(count, data.totalTickets);
                    return (
                      <div key={priority}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-navy-300">{priority}</span>
                          <span className="text-navy-400 tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${PRIORITY_BAR_CLASSES[priority]}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Category */}
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
                  By Category
                </h2>
                <div className="space-y-3">
                  {TICKET_CATEGORIES.map((category: TicketCategory) => {
                    const count = data.ticketsByCategory[category] ?? 0;
                    const width = pct(count, data.totalTickets);
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-navy-300">{category}</span>
                          <span className="text-navy-400 tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all bg-teal-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Recent Tickets ────────────────────────────────────────────── */}
            <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
              <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
                Recent Tickets
              </h2>

              {data.recentTickets.length === 0 ? (
                <p className="text-navy-500 text-sm py-4">No tickets yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentTickets.map((ticket) => (
                    <Link
                      key={ticket._id}
                      to={`/tickets/${ticket._id}`}
                      className="flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-navy-700/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-teal-400 transition-colors">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-navy-500 mt-0.5">
                          {ticket.requester.name} · {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_TEXT_CLASSES[ticket.status]}`}
                        >
                          {ticket.status}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_TEXT_CLASSES[ticket.priority]}`}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {data.recentTickets.length > 0 && (
                <div className="mt-4 pt-3 border-t border-navy-700">
                  <Link
                    to="/tickets"
                    className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    View all tickets →
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
