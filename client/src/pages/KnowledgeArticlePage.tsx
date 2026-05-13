import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getArticleById, deleteArticle } from '../api/kb';
import { KnowledgeArticle } from '../types/kb';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Something went wrong. Please try again.';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function KnowledgeArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAgentOrAdmin = user?.role === 'support_agent' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!id) return;
    getArticleById(id)
      .then(setArticle)
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setPageError('Article not found.');
        } else {
          setPageError('Failed to load article.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!id || !window.confirm('Delete this article? This cannot be undone.')) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteArticle(id);
      navigate('/kb');
    } catch (err) {
      setDeleteError(extractMessage(err));
      setIsDeleting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (pageError || !article) {
    return (
      <AppLayout>
        <div className="p-8">
          <Link to="/kb" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
            ← Back to Knowledge Base
          </Link>
          <div className="mt-6 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {pageError || 'Article not found.'}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Detail ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        {/* Back link */}
        <Link to="/kb" className="text-sm text-navy-400 hover:text-teal-400 transition-colors">
          ← Back to Knowledge Base
        </Link>

        {/* Title + badges */}
        <div className="flex flex-wrap items-start justify-between gap-3 mt-4">
          <h1 className="text-2xl font-bold text-white leading-snug">{article.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-teal-500/20 text-teal-400">
              {article.category}
            </span>
            {isAgentOrAdmin && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  article.isPublished
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {article.isPublished ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-navy-400">
          <span>
            By: <span className="text-navy-300">{article.author.name}</span>
          </span>
          <span>
            Published: <span className="text-navy-300">{formatDate(article.createdAt)}</span>
          </span>
          {article.updatedAt !== article.createdAt && (
            <span>
              Updated: <span className="text-navy-300">{formatDate(article.updatedAt)}</span>
            </span>
          )}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {article.tags.map((tag) => (
              <span key={tag} className="text-xs bg-navy-700 text-navy-300 rounded px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="mt-5 bg-navy-800 border border-navy-700 rounded-lg p-5">
          <p className="text-navy-300 text-sm whitespace-pre-wrap leading-relaxed">
            {article.content}
          </p>
        </div>

        {/* Agent/Admin actions */}
        {isAgentOrAdmin && (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/kb/${id}/edit`)}
              className="bg-navy-700 hover:bg-navy-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
            >
              Edit Article
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-400 text-sm font-semibold px-4 py-2 rounded-md border border-red-500/30 transition-colors"
              >
                {isDeleting ? 'Deleting…' : 'Delete Article'}
              </button>
            )}
          </div>
        )}
        {deleteError && <p className="mt-2 text-red-400 text-xs">{deleteError}</p>}
      </div>
    </AppLayout>
  );
}
