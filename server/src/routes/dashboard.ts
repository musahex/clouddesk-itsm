import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getDashboard } from '../controllers/dashboardController';

const router = Router();

router.use(authMiddleware);

router.get('/', getDashboard);

export default router;
