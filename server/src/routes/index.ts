import { Router, Request, Response } from 'express';
import authRoutes from './auth';
import ticketRoutes from './tickets';
import kbRoutes from './kb';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'CloudDesk API' });
});

router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);

export default router;
