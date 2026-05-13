import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getAssignees } from '../controllers/userController';

const router = Router();

router.use(authMiddleware);

router.get('/assignees', requireRole('support_agent', 'admin'), getAssignees);

export default router;
