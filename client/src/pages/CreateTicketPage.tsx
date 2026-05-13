import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createTicket } from '../api/tickets';
import { TicketCategory, TicketPriority, TICKET_CATEGORIES, TICKET_PRIORITIES } from '../types/ticket';
import AppLayout from '../components/AppLayout';

export default function CreateTicketPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('General Support');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const ticket = await createTicket({ title, description, category, priority });
      navigate(`/tickets/${ticket._id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message as string);
      } else {
        setError('Failed to create ticket. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors';

  const labelClass = 'block text-sm font-medium text-navy-400 mb-1.5';

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Link to="/tickets" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
            ← Back to Tickets
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">New Ticket</h1>
          <p className="text-navy-400 text-sm mt-0.5">Describe the issue or request clearly.</p>
        </div>

        {/* Form card */}
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-6">
          {error && (
            <div className="mb-5 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail — include steps to reproduce, error messages, or any relevant context."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className={inputClass}
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className={inputClass}
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white font-semibold rounded-md px-5 py-2.5 text-sm transition-colors"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
              <Link
                to="/tickets"
                className="text-sm text-navy-400 hover:text-navy-300 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
