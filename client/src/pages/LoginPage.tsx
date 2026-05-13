import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message as string);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-teal-400 tracking-tight">CloudDesk</h1>
        <p className="text-navy-400 text-sm mt-1">ITSM Support Platform</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-md bg-navy-800 border border-navy-700 rounded-xl p-8">
        <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-400 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white font-semibold rounded-md px-4 py-2.5 text-sm transition-colors mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-navy-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
