import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getArticles, searchArticles } from '../api/kb';
import { KnowledgeArticle, KBCategory, KB_CATEGORIES } from '../types/kb';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Failed to load articles.';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAgentOrAdmin = user?.role === 'support_agent' || user?.role === 'admin';

  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<KBCategory | ''>('');

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setIsLoading(true);
    setPageError('');
    try {
      setArticles(await getArticles(isAgentOrAdmin));
    } catch (err) {
      setPageError(extractMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function doSearch(q: string, cat: KBCategory | '') {
    if (!q.trim() && !cat) {
      return loadAll();
    }
    setIsLoading(true);
    setPageError('');
    try {
      setArticles(
        await searchArticles({
          q: q.trim() || undefined,
          category: cat || undefined,
          includeUnpublished: isAgentOrAdmin,
        })
      );
    } catch (err) {
      setPageError(extractMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query, selectedCategory);
  }

  function handleCategoryChange(cat: KBCategory | '') {
    setSelectedCategory(cat);
    doSearch(query, cat);
  }

  function handleClear() {
    setQuery('');
    setSelectedCategory('');
    loadAll();
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
            <p className="text-navy-400 text-sm mt-0.5">
              {isLoading ? '…' : `${articles.length} article${articles.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {isAgentOrAdmin && (
            <Link
              to="/kb/new"
              className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
            >
              + New Article
            </Link>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="flex-1 min-w-48 bg-navy-800 border border-navy-700 rounded-md px-3 py-2 text-navy-300 placeholder-navy-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
          />
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value as KBCategory | '')}
            className="bg-navy-800 border border-navy-700 rounded-md px-3 py-2 text-navy-300 text-sm focus:outline-none focus:border-teal-500 transition-colors"
          >
            <option value="">All Categories</option>
            {KB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            Search
          </button>
          {(query || selectedCategory) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-navy-400 hover:text-white px-3 py-2 rounded-md border border-navy-700 hover:border-navy-600 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {/* Error */}
        {pageError && (
          <div className="mb-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {pageError}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !pageError && articles.length === 0 && (
          <div className="text-center py-16 bg-navy-800 border border-navy-700 rounded-lg">
            <p className="text-navy-400 text-sm mb-4">
              {query || selectedCategory
                ? 'No articles match your search.'
                : 'No articles yet.'}
            </p>
            {isAgentOrAdmin && !query && !selectedCategory && (
              <Link
                to="/kb/new"
                className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
              >
                Create your first article
              </Link>
            )}
          </div>
        )}

        {/* Article list */}
        {!isLoading && articles.length > 0 && (
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article._id}
                onClick={() => navigate(`/kb/${article._id}`)}
                className="bg-navy-800 border border-navy-700 rounded-lg p-5 cursor-pointer hover:border-navy-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-white font-semibold text-base leading-snug">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-500/20 text-teal-400">
                      {article.category}
                    </span>
                    {isAgentOrAdmin && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-navy-700 text-navy-300 rounded px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-navy-500 mt-3">
                  By {article.author.name} · {formatDate(article.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
