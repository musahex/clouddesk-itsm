import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getSystemHealth, getSystemEvents } from '../api/system';
import { SystemHealth, AppEvent, RouteMetric } from '../types/system';
import AppLayout from '../components/AppLayout';

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return 'Failed to load data.';
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
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
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function errorRate(s5xx: number, total: number): string {
  if (total === 0) return '0%';
  return `${((s5xx / total) * 100).toFixed(1)}%`;
}

function statusBadge(ok: boolean, okLabel: string, badLabel: string) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}
    >
      {ok ? okLabel : badLabel}
    </span>
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
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-navy-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">
      {title}
    </h2>
  );
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

function RouteMetricsTable({ rows }: { rows: RouteMetric[] }) {
  if (rows.length === 0) {
    return <p className="text-navy-500 text-sm py-4">No route data yet — metrics reset on server restart.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="text-left py-2 pr-4 text-navy-500 font-medium">Method</th>
            <th className="text-left py-2 pr-4 text-navy-500 font-medium">Path</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Count</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Avg RT</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Last Status</th>
            <th className="text-right py-2 pr-4 text-navy-500 font-medium">Errors</th>
            <th className="text-right py-2 text-navy-500 font-medium">Last Called</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.method}-${r.path}`}
              className={`border-b border-navy-700/50 ${i % 2 === 0 ? '' : 'bg-navy-800/30'}`}
            >
              <td className={`py-2 pr-4 font-mono font-semibold ${methodClass(r.method)}`}>
                {r.method}
              </td>
              <td className="py-2 pr-4 font-mono text-navy-300">{r.path}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-navy-300">{r.count}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-navy-300">
                {formatMs(r.averageResponseTimeMs)}
              </td>
              <td className={`py-2 pr-4 text-right tabular-nums font-medium ${statusCodeClass(r.lastStatusCode)}`}>
                {r.lastStatusCode}
              </td>
              <td className={`py-2 pr-4 text-right tabular-nums ${r.errorCount > 0 ? 'text-red-400' : 'text-navy-500'}`}>
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
    return <p className="text-navy-500 text-sm py-4">No events yet.</p>;
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
            <th className="text-right py-2 pr-3 text-navy-500 font-medium">RT</th>
            <th className="text-left py-2 text-navy-500 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr
              key={`${ev.timestamp}-${i}`}
              className={`border-b border-navy-700/40 ${i % 2 === 0 ? '' : 'bg-navy-800/30'}`}
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
              <td className={`py-1.5 pr-3 text-right tabular-nums font-medium ${statusCodeClass(ev.statusCode)}`}>
                {ev.statusCode}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-navy-400">
                {ev.responseTimeMs}ms
              </td>
              <td className="py-1.5 text-navy-400 font-mono">{ev.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const isOk = data?.status === 'ok';
  const dbOk = data?.database.status === 'connected';

  return (
    <AppLayout>
      <div className="p-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">System Health</h1>
            <p className="text-navy-400 text-sm mt-1">
              Admin
              {lastChecked && (
                <span className="ml-2 text-navy-500">
                  · Last checked {lastChecked.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadHealth}
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:bg-navy-700 disabled:text-navy-500 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors"
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-navy-700 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* ── Status overview ──────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader title="Status" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* API Status */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">API Status</p>
                    {statusBadge(isOk, 'OK', 'DEGRADED')}
                  </div>
                  <p className="text-sm font-medium text-white">{data.service}</p>
                  <p className="text-xs text-navy-500 mt-1">
                    Up {formatUptime(data.uptimeSeconds)}
                  </p>
                </div>

                {/* Database */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Database</p>
                    {statusBadge(dbOk, 'Connected', 'Disconnected')}
                  </div>
                  <p className="text-sm font-medium text-white">MongoDB</p>
                  <p className="text-xs text-navy-500 mt-1">
                    readyState {data.database.readyState}
                  </p>
                </div>

                {/* Sentry */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Sentry</p>
                    {statusBadge(
                      data.monitoring.sentryEnabled,
                      'Enabled',
                      'Disabled',
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">Error Tracking</p>
                  <p className="text-xs text-navy-500 mt-1 truncate">
                    {data.monitoring.apiRelease}
                  </p>
                </div>

                {/* Environment */}
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-navy-400">Environment</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-500/20 text-teal-400">
                      {data.environment}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {data.timestamp ? formatDateTime(data.timestamp) : '—'}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">Server timestamp</p>
                </div>
              </div>
            </div>

            {/* ── Runtime ──────────────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader title="Runtime" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Uptime"
                  value={formatUptime(data.uptimeSeconds)}
                  sub={`${data.uptimeSeconds}s total`}
                  valueClass="text-teal-400"
                />
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <p className="text-xs text-navy-400 mb-1">Memory</p>
                  <p className="text-lg font-bold text-white">
                    {formatMb(rt?.memory.heapUsedMb ?? 0)}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">
                    heap used / {formatMb(rt?.memory.heapTotalMb ?? 0)} total
                  </p>
                  <p className="text-xs text-navy-500">
                    RSS {formatMb(rt?.memory.rssMb ?? 0)}
                  </p>
                </div>
                <StatCard
                  label="Node.js"
                  value={rt?.nodeVersion ?? '—'}
                  sub={rt?.platform ?? '—'}
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

            {/* ── Application data ─────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader title="Application Data" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
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
                  label="Open"
                  value={app?.tickets.open ?? 0}
                  valueClass="text-blue-400"
                />
                <StatCard
                  label="Resolved"
                  value={app?.tickets.resolved ?? 0}
                  valueClass="text-green-400"
                />
                <StatCard
                  label="Critical"
                  value={app?.tickets.critical ?? 0}
                  valueClass="text-red-400"
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

            {/* ── Request metrics ──────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader title="Request Metrics" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                <StatCard
                  label="Total Requests"
                  value={req?.totalRequests ?? 0}
                  sub="since last restart"
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
                    (req?.status5xx ?? 0) > 0 ? 'text-red-400' : 'text-navy-400'
                  }
                />
                <StatCard
                  label="Error Rate"
                  value={errorRate(req?.status5xx ?? 0, req?.totalRequests ?? 0)}
                  valueClass={
                    (req?.status5xx ?? 0) > 0 ? 'text-red-400' : 'text-green-400'
                  }
                />
              </div>

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
                <div className="flex flex-wrap gap-4">
                  {Object.entries(data.requestsByMethod ?? {}).map(([method, count]) => (
                    <div key={method} className="text-center">
                      <p className={`text-sm font-bold font-mono ${methodClass(method)}`}>
                        {count}
                      </p>
                      <p className="text-xs text-navy-500">{method}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Route metrics ────────────────────────────────────────── */}
            <div className="mb-8">
              <SectionHeader title="Route Metrics" />
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                <RouteMetricsTable rows={data.routeMetrics ?? []} />
              </div>
            </div>

            {/* ── Recent Application Events ─────────────────────────── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="Recent Application Events" />
                <button
                  onClick={() => setShowEvents((v) => !v)}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  {showEvents ? 'Hide Events' : 'Show Recent Application Events'}
                </button>
              </div>

              {showEvents && (
                <div className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-navy-500">
                        Sanitized application events — no request bodies, headers, or credentials.
                        Capped at 200. Resets on server restart.
                      </p>
                      {totalAvailable > 0 && (
                        <p className="text-xs text-navy-500 mt-0.5">
                          Showing 50 most recent of {totalAvailable} buffered events.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={loadEvents}
                      disabled={eventsLoading}
                      className="text-xs text-teal-400 hover:text-teal-300 disabled:text-navy-600 transition-colors ml-4 shrink-0"
                    >
                      {eventsLoading ? 'Loading…' : 'Refresh'}
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
