import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';
import authRoutes from './auth';
import ticketRoutes from './tickets';
import kbRoutes from './kb';
import dashboardRoutes from './dashboard';
import userRoutes from './users';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CloudDesk API',
    environment: env.nodeEnv,
    sentryEnabled: env.sentryEnabled,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

router.get('/health/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    service: 'CloudDesk API',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/ready', (_req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    database: isReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
