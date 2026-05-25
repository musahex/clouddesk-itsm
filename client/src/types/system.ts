export type SystemStatus = 'ok' | 'degraded';
export type DbStatus = 'connected' | 'disconnected';
export type EventLevel = 'info' | 'warn' | 'error';

export interface RouteMetric {
  method: string;
  path: string;
  count: number;
  averageResponseTimeMs: number;
  lastStatusCode: number;
  lastCalledAt: string;
  errorCount: number;
}

export interface SystemHealth {
  service: string;
  status: SystemStatus;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: DbStatus;
    readyState: number;
  };
  monitoring: {
    sentryEnabled: boolean;
    apiRelease: string;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    pid: number;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      externalMb: number;
    };
    cpuUsage: {
      userMicros: number;
      systemMicros: number;
    };
  };
  application: {
    users: number;
    tickets: {
      total: number;
      open: number;
      resolved: number;
      critical: number;
    };
    knowledgeBase: {
      total: number;
      published: number;
    };
  };
  requests: {
    totalRequests: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    averageResponseTimeMs: number;
    slowestResponseTimeMs: number;
    recentErrorCount: number;
    lastRequestAt: string | null;
  };
  requestsByMethod: Record<string, number>;
  routeMetrics: RouteMetric[];
}

export interface AppEvent {
  timestamp: string;
  level: EventLevel;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  message: string;
}

export interface SystemEventsResponse {
  events: AppEvent[];
  limit: number;
  totalAvailable: number;
}
