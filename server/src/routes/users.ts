import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getAssignees, createSupportAgent } from '../controllers/userController';

const router = Router();

router.use(authMiddleware);

router.get('/assignees', requireRole('support_agent', 'admin'), getAssignees);
router.post('/support-agents', requireRole('admin'), createSupportAgent);

export default router;
