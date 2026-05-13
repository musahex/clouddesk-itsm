import { useState, FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import { createArticle } from '../api/kb';
import { KBCategory, KB_CATEGORIES } from '../types/kb';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';

export default function CreateKnowledgeArticlePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAgentOrAdmin = user?.role === 'support_agent' || user?.role === 'admin';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KBCategory>('General Support');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAgentOrAdmin) {
    return <Navigate to="/kb" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const article = await createArticle({ title, content, category, tags, isPublished });
      navigate(`/kb/${article._id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message as string);
      } else {
        setError('Failed to create article. Please try again.');
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
        <div className="mb-6">
          <Link to="/kb" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
            ← Back to Knowledge Base
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">New Article</h1>
          <p className="text-navy-400 text-sm mt-0.5">
            Write a knowledge base article for your team.
          </p>
        </div>

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
                placeholder="Article title"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Content</label>
              <textarea
                required
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the article content here…"
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as KBCategory)}
                  className={inputClass}
                >
                  {KB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Tags</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="vpn, network, access"
                  className={inputClass}
                />
                <p className="text-xs text-navy-500 mt-1">Comma-separated</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isPublished"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-navy-600 text-teal-500 focus:ring-teal-500 bg-navy-900"
              />
              <label htmlFor="isPublished" className="text-sm text-navy-400 cursor-pointer">
                Publish immediately
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white font-semibold rounded-md px-5 py-2.5 text-sm transition-colors"
              >
                {isSubmitting ? 'Saving…' : isPublished ? 'Publish Article' : 'Save as Draft'}
              </button>
              <Link
                to="/kb"
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
