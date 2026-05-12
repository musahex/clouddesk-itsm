import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateStatus,
  addComment,
  assignTicket,
} from '../controllers/ticketController';

const router = Router();

router.use(authMiddleware);

router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.patch('/:id/status', requireRole('support_agent', 'admin'), updateStatus);
router.post('/:id/comments', addComment);
router.patch('/:id/assign', requireRole('support_agent', 'admin'), assignTicket);

export default router;
