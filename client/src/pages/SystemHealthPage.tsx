import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getSystemHealth, getSystemEvents } from '../api/system';
import { SystemHealth, AppEvent, RouteMetric } from '../types/system';
import AppLayout from '../components/AppLayout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Failed to load data.';
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatMb(mb: number): string {
  return `${mb.toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function computedErrorRate(s5xx: number, total: number): string {
  if (total === 0 || s5xx === 0) return '0%';
  return `${((s5xx / total) * 100).toFixed(1)}%`;
}

function errorRateClass(s5xx: number, total: number): string {
  if (total === 0 || s5xx === 0) return 'text-teal-400';
  const rate = (s5xx / total) * 100;
  return rate <= 2 ? 'text-amber-400' : 'text-red-400';
}

function levelClass(level: string): string {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-amber-400';
  return 'text-teal-400';
}

function statusCodeClass(code: number): string {
  if (code >= 500) return 'text-red-400';
  if (code >= 400) return 'text-amber-400';
  if (code >= 300) return 'text-blue-400';
  return 'text-green-400';
}

function methodClass(method: string): string {
  const map: Record<string, string> = {
    GET: 'text-teal-400',
    POST: 'text-blue-400',
    PATCH: 'text-amber-400',
    PUT: 'text-amber-400',
    DELETE: 'text-red-400',
  };
  return map[method] ?? 'text-navy-300';
}

// ── Overall health logic ──────────────────────────────────────────────────────

type OverallHealth = 'healthy' | 'degraded' | 'unhealthy';

function computeOverallHealth(data: SystemHealth | null, loadError: string): OverallHealth {
  if (loadError && !data) return 'unhealthy';
  if (!data) return 'unhealthy';
  const s5xx = data.requests?.status5xx ?? 0;
  if (
    data.status === 'degraded' ||
    data.database.status === 'disconnected' ||
    s5xx > 0
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function healthSummary(health: OverallHealth, data: SystemHealth | null): string {
  if (health === 'unhealthy') {
    return 'System health could not be loaded. Check API availability and backend logs.';
  }
  if (health === 'degraded') {
    const issues: string[] = [];
    if (data?.database.status !== 'connected') issues.push('database connectivity');
    if ((data?.requests?.status5xx ?? 0) > 0) issues.push('5xx server errors');
    if (data?.status === 'degraded') issues.push('API reported degraded state');
    return issues.length > 0
      ? `Some services need attention: ${issues.join(', ')}.`
      : 'Some services need attention. Review database, Sentry, or 5xx request metrics.';
  }
  return 'API, database, monitoring, and request metrics are operating normally.';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBanner({
  health,
  summary,
  lastChecked,
}: {
  health: OverallHealth;
  summary: string;
  lastChecked: Date | null;
}) {
  const cfg = {
    healthy: {
      border: 'border-green-500/30',
      bg: 'bg-green-500/5',
      dot: 'bg-green-400',
      labelClass: 'text-green-400',
      label: 'Healthy',
    },
    degraded: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/5',
      dot: 'bg-amber-400',
      labelClass: 'text-amber-400',
      label: 'Degraded',
    },
    unhealthy: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      dot: 'bg-red-400',
      labelClass: 'text-red-400',
      label: 'Unhealthy',
    },
  }[health];

  return (
    <div
      className={`rounded-lg border ${cfg.border} ${cfg.bg} px-5 py-4 mb-8 flex items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${cfg.labelClass}`}>{cfg.label}</p>
          <p className="text-xs text-navy-400 mt-0.5 truncate">{summary}</p>
        </div>
      </div>
      {lastChecked && (
        <p className="text-xs text-navy-500 shrink-0">
          Last checked {lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider">{title}</h2>
      {sub && <p className="text-xs text-navy-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
      <p className="text-xs text-navy-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold truncate ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-navy-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function RouteMetricsTable({ rows }: { rows: RouteMetric[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-navy-500 text-sm py-4">
        No route metrics captured yet — metrics reset on server restart.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="text-left py-2 pr-4 text-navy-500 font-medium">Method</th>
            <th className="text-left py-2 pr-4 text-navy-500 font-medium">Path</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Count</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Avg Response</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Last Status</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Errors</th>
            <th className="text-right py-2 text-navy-500 font-medium">Last Called</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.method}-${r.path}`}
              className={`border-b border-navy-700/50 ${i % 2 !== 0 ? 'bg-navy-800/40' : ''}`}
            >
              <td className={`py-2 pr-4 font-mono font-semibold ${methodClass(r.method)}`}>
                {r.method}
              </td>
              <td className="py-2 pr-4 font-mono text-navy-300">{r.path}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-navy-300">{r.count}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-navy-300">
                {formatMs(r.averageResponseTimeMs)}
              </td>
              <td
                className={`py-2 pr-4 text-right tabular-nums font-medium ${statusCodeClass(r.lastStatusCode)}`}
              >
                {r.lastStatusCode}
              </td>
              <td
                className={`py-2 pr-4 text-right tabular-nums font-medium ${
                  r.errorCount > 0 ? 'text-red-400' : 'text-navy-600'
                }`}
              >
                {r.errorCount}
              </td>
              <td className="py-2 text-right text-navy-500">{formatTime(r.lastCalledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsTable({ events }: { events: AppEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-navy-500 text-sm py-4">No application events captured yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="text-left py-2 pr-3 text-navy-500 font-medium">Time</th>
            <th className="text-left py-2 pr-3 text-navy-500 font-medium">Level</th>
            <th className="text-left py-2 pr-3 text-navy-500 font-medium">Method</th>
            <th className="text-left py-2 pr-3 text-navy-500 font-medium">Path</th>
            <th className="text-right py-2 pr-3 text-navy-500 font-medium">Status</th>
            <th className="text-right py-2 pr-3 text-navy-500 font-medium">Response Time</th>
            <th className="text-left py-2 text-navy-500 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr
              key={`${ev.timestamp}-${i}`}
              className={`border-b border-navy-700/40 ${i % 2 !== 0 ? 'bg-navy-800/40' : ''}`}
            >
              <td className="py-1.5 pr-3 text-navy-500 tabular-nums whitespace-nowrap">
                {formatTime(ev.timestamp)}
              </td>
              <td className={`py-1.5 pr-3 font-semibold uppercase ${levelClass(ev.level)}`}>
                {ev.level}
              </td>
              <td className={`py-1.5 pr-3 font-mono font-semibold ${methodClass(ev.method)}`}>
                {ev.method}
              </td>
              <td className="py-1.5 pr-3 font-mono text-navy-300">{ev.path}</td>
              <td
                className={`py-1.5 pr-3 text-right tabular-nums font-medium ${statusCodeClass(ev.statusCode)}`}
              >
                {ev.statusCode}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-navy-400">
                {ev.responseTimeMs}ms
              </td>
              <td className="py-1.5 font-mono text-navy-400">{ev.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [totalAvailable, setTotalAvailable] = useState(0);

  const loadHealth = useCallback(() => {
    setIsLoading(true);
    setError('');
    getSystemHealth()
      .then((d) => {
        setData(d);
        setLastChecked(new Date());
      })
      .catch((err) => setError(extractMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const loadEvents = useCallback(() => {
    setEventsLoading(true);
    setEventsError('');
    getSystemEvents(50)
      .then((d) => {
        setEvents(d.events);
        setTotalAvailable(d.totalAvailable);
      })
      .catch((err) => setEventsError(extractMessage(err)))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (showEvents) loadEvents();
  }, [showEvents, loadEvents]);

  const req = data?.requests;
  const rt = data?.runtime;
  const app = data?.application;
  const dbOk = data?.database.status === 'connected';
  const sentryEnabled = data?.monitoring.sentryEnabled ?? false;
  const envIsProd = data?.environment === 'production';

  const overall = computeOverallHealth(data, error);
  const summary = healthSummary(overall, data);

  const showBanner = !isLoading || data !== null || error !== '';

  return (
    <AppLayout>
      <div className="p-8">
        {/* ── Page header ────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">System Health</h1>
            <p className="text-navy-400 text-sm mt-1">Admin · Application operations dashboard</p>
          </div>
          <button
            onClick={loadHealth}
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors"
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* ── Overall health banner ──────────────────────────────────────── */}
        {showBanner && (
          <HealthBanner health={overall} summary={summary} lastChecked={lastChecked} />
        )}

        {/* Error detail */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Initial loading spinner */}
        {isLoading && !data && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* ── Status ────────────────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader
                title="Status"
                sub="Live service state and monitoring configuration"
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* API */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">API Status</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        data.status === 'ok'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {data.status === 'ok' ? 'OK' : 'DEGRADED'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{data.service}</p>
                  <p className="text-xs text-navy-500 mt-1">
                    Uptime {formatUptime(data.uptimeSeconds)}
                  </p>
                </div>

                {/* Database */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Database</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        dbOk
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {dbOk ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">MongoDB</p>
                  <p className="text-xs text-navy-500 mt-1">
                    readyState {data.database.readyState}
                  </p>
                </div>

                {/* Error Tracking */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Error Tracking</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sentryEnabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {sentryEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {sentryEnabled ? 'Sentry Enabled' : 'Sentry Disabled'}
                  </p>
                  <p className="text-xs text-navy-500 mt-1 truncate">
                    {sentryEnabled
                      ? `Release: ${data.monitoring.apiRelease}`
                      : 'Not enabled for this environment'}
                  </p>
                </div>

                {/* Environment */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Environment</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        envIsProd
                          ? 'bg-teal-500/20 text-teal-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {data.environment}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatDateTime(data.timestamp)}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">Server timestamp</p>
                </div>
              </div>
            </div>

            {/* ── Runtime ───────────────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader
                title="Runtime"
                sub="Node.js process-level metrics since the API started"
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Uptime"
                  value={formatUptime(data.uptimeSeconds)}
                  sub={`${data.uptimeSeconds}s total`}
                  valueClass="text-teal-400"
                />
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <p className="text-xs text-navy-400 mb-1">Memory</p>
                  <p className="text-2xl font-bold text-white">
                    {formatMb(rt?.memory.heapUsedMb ?? 0)}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">
                    heap used / {formatMb(rt?.memory.heapTotalMb ?? 0)} total
                  </p>
                  <p className="text-xs text-navy-500">RSS {formatMb(rt?.memory.rssMb ?? 0)}</p>
                </div>
                <StatCard
                  label="Node.js Version"
                  value={rt?.nodeVersion ?? '—'}
                  sub={`Platform: ${rt?.platform ?? '—'}`}
                  valueClass="text-blue-400"
                />
                <StatCard
                  label="Process ID"
                  value={rt?.pid ?? '—'}
                  sub={`Platform: ${rt?.platform ?? '—'}`}
                  valueClass="text-navy-300"
                />
              </div>
            </div>

            {/* ── Application data ──────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader
                title="Application Data"
                sub="High-level operational data from the CloudDesk database"
              />
              {/* Row 1 — users + ticket counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <StatCard
                  label="Users"
                  value={app?.users ?? 0}
                  valueClass="text-teal-400"
                />
                <StatCard
                  label="Total Tickets"
                  value={app?.tickets.total ?? 0}
                  valueClass="text-white"
                />
                <StatCard
                  label="Open Tickets"
                  value={app?.tickets.open ?? 0}
                  valueClass="text-blue-400"
                />
                <StatCard
                  label="Resolved Tickets"
                  value={app?.tickets.resolved ?? 0}
                  valueClass="text-green-400"
                />
              </div>
              {/* Row 2 — critical + KB */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Critical Tickets"
                  value={app?.tickets.critical ?? 0}
                  valueClass={
                    (app?.tickets.critical ?? 0) > 0 ? 'text-red-400' : 'text-navy-500'
                  }
                />
                <StatCard
                  label="KB Articles"
                  value={app?.knowledgeBase.total ?? 0}
                  valueClass="text-white"
                />
                <StatCard
                  label="KB Published"
                  value={app?.knowledgeBase.published ?? 0}
                  valueClass="text-green-400"
                />
              </div>
            </div>

            {/* ── Request metrics ───────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader
                title="Request Metrics"
                sub="In-memory API traffic metrics since the last server restart"
              />

              {/* In-memory note */}
              <p className="text-xs text-navy-600 mb-4">
                Metrics are stored in memory and reset whenever the API container restarts.
              </p>

              {/* Status code counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                <StatCard
                  label="Total Requests"
                  value={req?.totalRequests ?? 0}
                  valueClass="text-teal-400"
                />
                <StatCard
                  label="2xx Success"
                  value={req?.status2xx ?? 0}
                  valueClass="text-green-400"
                />
                <StatCard
                  label="3xx Redirect"
                  value={req?.status3xx ?? 0}
                  valueClass="text-blue-400"
                />
                <StatCard
                  label="4xx Client Err"
                  value={req?.status4xx ?? 0}
                  valueClass="text-amber-400"
                />
                <StatCard
                  label="5xx Server Err"
                  value={req?.status5xx ?? 0}
                  valueClass={
                    (req?.status5xx ?? 0) > 0 ? 'text-red-400' : 'text-navy-600'
                  }
                />
                <StatCard
                  label="Error Rate"
                  value={computedErrorRate(req?.status5xx ?? 0, req?.totalRequests ?? 0)}
                  valueClass={errorRateClass(req?.status5xx ?? 0, req?.totalRequests ?? 0)}
                />
              </div>

              {/* Timing + last request */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Avg Response Time"
                  value={formatMs(req?.averageResponseTimeMs ?? 0)}
                  valueClass="text-white"
                />
                <StatCard
                  label="Slowest Response"
                  value={formatMs(req?.slowestResponseTimeMs ?? 0)}
                  valueClass={
                    (req?.slowestResponseTimeMs ?? 0) > 2000
                      ? 'text-amber-400'
                      : 'text-white'
                  }
                />
                <StatCard
                  label="Last Request"
                  value={formatTime(req?.lastRequestAt)}
                  valueClass="text-navy-300"
                />
              </div>

              {/* Method breakdown */}
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <p className="text-xs text-navy-400 mb-3">Requests by Method</p>
                <div className="flex flex-wrap gap-6">
                  {Object.entries(data.requestsByMethod ?? {}).map(([method, count]) => (
                    <div key={method} className="text-center min-w-[2.5rem]">
                      <p className={`text-base font-bold font-mono tabular-nums ${methodClass(method)}`}>
                        {count}
                      </p>
                      <p className="text-xs text-navy-500 mt-0.5">{method}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Route metrics ─────────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader
                title="Route Metrics"
                sub="Per-route request behaviour and error visibility"
              />
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <RouteMetricsTable rows={data.routeMetrics ?? []} />
              </div>
            </div>

            {/* ── Recent Application Events ──────────────────────────────── */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4 gap-4">
                <SectionHeader
                  title="Recent Application Events"
                  sub="Sanitised recent request events. No headers, tokens, passwords, request bodies, or stack traces are shown."
                />
                <button
                  onClick={() => setShowEvents((v) => !v)}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors shrink-0 mt-0.5"
                >
                  {showEvents
                    ? 'Hide Recent Application Events'
                    : 'Show Recent Application Events'}
                </button>
              </div>

              {showEvents && (
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  {/* Events header row */}
                  <div className="flex items-center justify-between mb-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-navy-500">
                        These are sanitised application events, not raw backend logs.
                        Capped at 200 events. Resets on server restart.
                      </p>
                      {totalAvailable > 0 && (
                        <p className="text-xs text-navy-600 mt-0.5">
                          Showing 50 most recent of {totalAvailable} buffered events.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={loadEvents}
                      disabled={eventsLoading}
                      className="text-xs text-teal-400 hover:text-teal-300 disabled:text-navy-600 transition-colors shrink-0"
                    >
                      {eventsLoading ? 'Loading…' : 'Refresh Events'}
                    </button>
                  </div>

                  {eventsError && (
                    <div className="mb-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
                      {eventsError}
                    </div>
                  )}

                  {eventsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <EventsTable events={events} />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
