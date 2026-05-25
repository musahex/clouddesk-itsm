export interface RouteMetric {
  method: string;
  path: string;
  count: number;
  averageResponseTimeMs: number;
  lastStatusCode: number;
  lastCalledAt: string;
  errorCount: number;
}

export interface AppMetrics {
  totalRequests: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  requestsByMethod: Record<string, number>;
  averageResponseTimeMs: number;
  slowestResponseTimeMs: number;
  lastRequestAt: string | null;
  recentErrorCount: number;
  routeMetrics: RouteMetric[];
}

interface RouteEntry {
  method: string;
  path: string;
  count: number;
  totalTime: number;
  lastStatusCode: number;
  lastCalledAt: string;
  errorCount: number;
}

const state = {
  totalRequests: 0,
  status2xx: 0,
  status3xx: 0,
  status4xx: 0,
  status5xx: 0,
  requestsByMethod: {
    GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0, OPTIONS: 0, HEAD: 0,
  } as Record<string, number>,
  totalResponseTime: 0,
  slowestResponseTimeMs: 0,
  lastRequestAt: null as string | null,
  recentErrorCount: 0,
  routeMap: new Map<string, RouteEntry>(),
};

// Replace 24-character hex ObjectIds with :id placeholder
function sanitizePath(rawPath: string): string {
  return rawPath.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id');
}

export function recordRequest(
  method: string,
  rawPath: string,
  statusCode: number,
  responseTimeMs: number,
): void {
  const path = sanitizePath(rawPath);
  const upperMethod = method.toUpperCase();
  const now = new Date().toISOString();

  state.totalRequests += 1;
  state.totalResponseTime += responseTimeMs;
  state.lastRequestAt = now;

  if (statusCode >= 200 && statusCode < 300) state.status2xx += 1;
  else if (statusCode >= 300 && statusCode < 400) state.status3xx += 1;
  else if (statusCode >= 400 && statusCode < 500) state.status4xx += 1;
  else if (statusCode >= 500) {
    state.status5xx += 1;
    state.recentErrorCount += 1;
  }

  if (upperMethod in state.requestsByMethod) {
    state.requestsByMethod[upperMethod] += 1;
  }

  if (responseTimeMs > state.slowestResponseTimeMs) {
    state.slowestResponseTimeMs = responseTimeMs;
  }

  const key = `${upperMethod} ${path}`;
  const existing = state.routeMap.get(key);
  if (existing) {
    existing.count += 1;
    existing.totalTime += responseTimeMs;
    existing.lastStatusCode = statusCode;
    existing.lastCalledAt = now;
    if (statusCode >= 500) existing.errorCount += 1;
  } else {
    state.routeMap.set(key, {
      method: upperMethod,
      path,
      count: 1,
      totalTime: responseTimeMs,
      lastStatusCode: statusCode,
      lastCalledAt: now,
      errorCount: statusCode >= 500 ? 1 : 0,
    });
  }
}

export function getMetrics(): AppMetrics {
  const avg =
    state.totalRequests > 0
      ? Math.round((state.totalResponseTime / state.totalRequests) * 10) / 10
      : 0;

  const routeMetrics: RouteMetric[] = Array.from(state.routeMap.values())
    .map((r) => ({
      method: r.method,
      path: r.path,
      count: r.count,
      averageResponseTimeMs: Math.round((r.totalTime / r.count) * 10) / 10,
      lastStatusCode: r.lastStatusCode,
      lastCalledAt: r.lastCalledAt,
      errorCount: r.errorCount,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRequests: state.totalRequests,
    status2xx: state.status2xx,
    status3xx: state.status3xx,
    status4xx: state.status4xx,
    status5xx: state.status5xx,
    requestsByMethod: { ...state.requestsByMethod },
    averageResponseTimeMs: avg,
    slowestResponseTimeMs: state.slowestResponseTimeMs,
    lastRequestAt: state.lastRequestAt,
    recentErrorCount: state.recentErrorCount,
    routeMetrics,
  };
}
