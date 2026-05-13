import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { getTicketById, updateTicketStatus, addComment, assignTicket } from '../api/tickets';
import { Ticket, TicketStatus, TICKET_STATUSES } from '../types/ticket';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';

const STATUS_CLASSES: Record<TicketStatus, string> = {
  New: 'bg-slate-500/20 text-slate-300',
  Assigned: 'bg-blue-500/20 text-blue-400',
  'In Progress': 'bg-teal-500/20 text-teal-400',
  Escalated: 'bg-orange-500/20 text-orange-400',
  Resolved: 'bg-green-500/20 text-green-400',
  Closed: 'bg-navy-700/60 text-navy-400',
};

const PRIORITY_CLASSES = {
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Something went wrong. Please try again.';
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAgentOrAdmin = user?.role === 'support_agent' || user?.role === 'admin';

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Status update
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('New');
  const [statusError, setStatusError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Assign
  const [assignTo, setAssignTo] = useState('');
  const [assignError, setAssignError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Comment
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTicketById(id)
      .then((t) => {
        setTicket(t);
        setSelectedStatus(t.status);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setPageError('Ticket not found.');
        } else if (axios.isAxiosError(err) && err.response?.status === 403) {
          setPageError('You do not have permission to view this ticket.');
        } else {
          setPageError('Failed to load ticket.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleUpdateStatus(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !id) return;
    setStatusError('');
    setIsUpdatingStatus(true);
    try {
      const updated = await updateTicketStatus(id, { status: selectedStatus });
      setTicket(updated);
    } catch (err) {
      setStatusError(extractMessage(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !id) return;
    setAssignError('');
    setIsAssigning(true);
    try {
      const updated = await assignTicket(id, { assignedTo: assignTo.trim() });
      setTicket(updated);
      setAssignTo('');
    } catch (err) {
      setAssignError(extractMessage(err));
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !id || !commentBody.trim()) return;
    setCommentError('');
    setIsAddingComment(true);
    try {
      const updated = await addComment(id, {
        body: commentBody.trim(),
        isInternal: isAgentOrAdmin ? isInternal : false,
      });
      setTicket(updated);
      setCommentBody('');
      setIsInternal(false);
    } catch (err) {
      setCommentError(extractMessage(err));
    } finally {
      setIsAddingComment(false);
    }
  }

  // Requesters do not see internal comments
  const visibleComments =
    ticket?.comments.filter((c) => (user?.role === 'requester' ? !c.isInternal : true)) ?? [];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (pageError || !ticket) {
    return (
      <AppLayout>
        <div className="p-8">
          <Link to="/tickets" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
            ← Back to Tickets
          </Link>
          <div className="mt-6 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {pageError || 'Ticket not found.'}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Detail ───────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        {/* Back link */}
        <Link to="/tickets" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
          ← Back to Tickets
        </Link>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mt-4">
          <h1 className="text-2xl font-bold text-white leading-snug">{ticket.title}</h1>
          <div className="flex gap-2 shrink-0">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASSES[ticket.status]}`}
            >
              {ticket.status}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_CLASSES[ticket.priority]}`}
            >
              {ticket.priority}
            </span>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-navy-400">
          <span>
            ID: <span className="text-navy-300 font-mono">{ticket._id.slice(-8)}</span>
          </span>
          <span>Category: <span className="text-navy-300">{ticket.category}</span></span>
          <span>By: <span className="text-navy-300">{ticket.requester.name}</span></span>
          <span>
            Assigned:{' '}
            <span className="text-navy-300">{ticket.assignedTo?.name ?? 'Unassigned'}</span>
          </span>
          <span>Created: <span className="text-navy-300">{formatDate(ticket.createdAt)}</span></span>
          {ticket.resolvedAt && (
            <span>
              Resolved: <span className="text-green-400">{formatDate(ticket.resolvedAt)}</span>
            </span>
          )}
        </div>

        {/* Description */}
        <div className="mt-5 bg-navy-800 border border-navy-700 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">
            Description
          </h2>
          <p className="text-navy-300 text-sm whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Agent / Admin actions */}
        {isAgentOrAdmin && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Update Status */}
            <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
              <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
                Update Status
              </h2>
              {statusError && (
                <p className="text-red-400 text-xs mb-3">{statusError}</p>
              )}
              <form onSubmit={handleUpdateStatus} className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                  className="flex-1 bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isUpdatingStatus || selectedStatus === ticket.status}
                  className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
                >
                  {isUpdatingStatus ? 'Saving…' : 'Update'}
                </button>
              </form>
            </div>

            {/* Assign Ticket */}
            <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
              <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-1">
                Assign Ticket
              </h2>
              <p className="text-xs text-navy-500 mb-4">
                Currently:{' '}
                <span className="text-navy-300">{ticket.assignedTo?.name ?? 'Unassigned'}</span>
              </p>
              {assignError && (
                <p className="text-red-400 text-xs mb-3">{assignError}</p>
              )}
              <form onSubmit={handleAssign} className="flex gap-2">
                <input
                  type="text"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  placeholder="User ID"
                  className="flex-1 bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={isAssigning || !assignTo.trim()}
                  className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
                >
                  {isAssigning ? 'Assigning…' : 'Assign'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4">
            Comments ({visibleComments.length})
          </h2>

          {/* Comment list */}
          <div className="space-y-3">
            {visibleComments.length === 0 && (
              <p className="text-navy-500 text-sm py-4">No comments yet.</p>
            )}
            {visibleComments.map((comment) => (
              <div
                key={comment._id}
                className={`rounded-lg p-4 border ${
                  comment.isInternal
                    ? 'bg-amber-950/20 border-amber-700/30'
                    : 'bg-navy-800 border-navy-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-white">{comment.author.name}</span>
                  <span className="text-xs text-navy-500">{comment.author.role.replace('_', ' ')}</span>
                  {comment.isInternal && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                      Internal
                    </span>
                  )}
                  <span className="text-xs text-navy-500 ml-auto">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-navy-300 leading-relaxed">{comment.body}</p>
              </div>
            ))}
          </div>

          {/* Add comment form */}
          <form
            onSubmit={handleAddComment}
            className="mt-4 bg-navy-800 border border-navy-700 rounded-lg p-5"
          >
            <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">
              Add Comment
            </h3>
            {commentError && (
              <p className="text-red-400 text-xs mb-3">{commentError}</p>
            )}
            <textarea
              rows={3}
              required
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              className="w-full bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              {isAgentOrAdmin ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-navy-600 text-teal-500 focus:ring-teal-500 bg-navy-900"
                  />
                  <span className="text-xs text-navy-400">Internal note</span>
                </label>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={isAddingComment || !commentBody.trim()}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
              >
                {isAddingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
