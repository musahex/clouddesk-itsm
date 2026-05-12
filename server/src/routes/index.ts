import { Router, Request, Response } from 'express';
import authRoutes from './auth';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'CloudDesk API' });
});

router.use('/auth', authRoutes);

export default router;
