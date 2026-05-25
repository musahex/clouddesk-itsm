import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { getMetrics } from '../monitoring/metrics';
import { getEvents } from '../monitoring/events';
import User from '../models/User';
import Ticket from '../models/Ticket';
import KnowledgeArticle from '../models/KnowledgeArticle';

const OPEN_STATUSES = ['New', 'Assigned', 'In Progress', 'Escalated'];
const RESOLVED_STATUSES = ['Resolved', 'Closed'];

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export async function getSystemHealth(_req: Request, res: Response): Promise<void> {
  const dbConnected = mongoose.connection.readyState === 1;
  let overallStatus: 'ok' | 'degraded' = dbConnected ? 'ok' : 'degraded';

  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const metrics = getMetrics();

  // Application DB counts — degrade gracefully if queries fail
  let appData: {
    users: number;
    tickets: { total: number; open: number; resolved: number; critical: number };
    knowledgeBase: { total: number; published: number };
  } | null = null;

  if (dbConnected) {
    try {
      const [
        totalUsers,
        totalTickets,
        openTickets,
        resolvedTickets,
        criticalTickets,
        totalKB,
        publishedKB,
      ] = await Promise.all([
        User.countDocuments(),
        Ticket.countDocuments(),
        Ticket.countDocuments({ status: { $in: OPEN_STATUSES } }),
        Ticket.countDocuments({ status: { $in: RESOLVED_STATUSES } }),
        Ticket.countDocuments({ priority: 'Critical' }),
        KnowledgeArticle.countDocuments(),
        KnowledgeArticle.countDocuments({ isPublished: true }),
      ]);

      appData = {
        users: totalUsers,
        tickets: {
          total: totalTickets,
          open: openTickets,
          resolved: resolvedTickets,
          critical: criticalTickets,
        },
        knowledgeBase: { total: totalKB, published: publishedKB },
      };
    } catch {
      overallStatus = 'degraded';
    }
  }

  res.json({
    service: 'CloudDesk API',
    status: overallStatus,
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
    },
    monitoring: {
      sentryEnabled: env.sentryEnabled,
      apiRelease: env.sentryRelease,
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      memory: {
        rssMb: toMb(mem.rss),
        heapUsedMb: toMb(mem.heapUsed),
        heapTotalMb: toMb(mem.heapTotal),
        externalMb: toMb(mem.external),
      },
      cpuUsage: {
        userMicros: cpu.user,
        systemMicros: cpu.system,
      },
    },
    application: appData ?? {
      users: 0,
      tickets: { total: 0, open: 0, resolved: 0, critical: 0 },
      knowledgeBase: { total: 0, published: 0 },
    },
    requests: {
      totalRequests: metrics.totalRequests,
      status2xx: metrics.status2xx,
      status3xx: metrics.status3xx,
      status4xx: metrics.status4xx,
      status5xx: metrics.status5xx,
      averageResponseTimeMs: metrics.averageResponseTimeMs,
      slowestResponseTimeMs: metrics.slowestResponseTimeMs,
      recentErrorCount: metrics.recentErrorCount,
      lastRequestAt: metrics.lastRequestAt,
    },
    requestsByMethod: metrics.requestsByMethod,
    routeMetrics: metrics.routeMetrics.slice(0, 25),
  });
}

export function getSystemEvents(req: Request, res: Response): void {
  const raw = parseInt(req.query.limit as string, 10);
  const limit = !isNaN(raw) && raw > 0 ? Math.min(raw, 100) : 50;

  const all = getEvents();
  // Return newest first so the UI shows most recent events at the top
  const events = all.slice(-limit).reverse();

  res.json({
    events,
    limit,
    totalAvailable: all.length,
  });
}
