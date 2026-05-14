import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { createSupportAgent } from '../api/users';
import { CreatedSupportAgent } from '../types/user';
import AppLayout from '../components/AppLayout';

export default function CreateSupportAgentPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedSupportAgent | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { user } = await createSupportAgent({ name, email, password });
      setCreated(user);
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message as string);
      } else {
        setError('Failed to create support agent. Please try again.');
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
      <div className="p-8 max-w-lg">
        <div className="mb-6">
          <Link to="/dashboard" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">Create Support Agent</h1>
          <p className="text-navy-400 text-sm mt-0.5">
            Create a new support agent account. The agent can log in immediately with the credentials you provide.
          </p>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-lg p-6">
          {error && (
            <div className="mb-5 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {created && (
            <div className="mb-5 bg-teal-900/20 border border-teal-500/30 rounded-md px-4 py-4 text-sm">
              <p className="text-teal-400 font-semibold mb-2">Support agent created successfully</p>
              <div className="space-y-1 text-navy-300">
                <p><span className="text-navy-500">Name: </span>{created.name}</p>
                <p><span className="text-navy-500">Email: </span>{created.email}</p>
                <p><span className="text-navy-500">Role: </span>{created.role.replace('_', ' ')}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agent's full name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Temporary password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password"
                className={inputClass}
              />
              <p className="text-xs text-navy-500 mt-1">
                Min 8 characters · one uppercase · one lowercase · one number
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white font-semibold rounded-md px-5 py-2.5 text-sm transition-colors"
              >
                {isSubmitting ? 'Creating…' : 'Create Support Agent'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
