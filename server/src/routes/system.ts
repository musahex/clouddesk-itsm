import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getSystemHealth, getSystemEvents } from '../controllers/systemController';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/health', getSystemHealth);
router.get('/events', getSystemEvents);

export default router;
