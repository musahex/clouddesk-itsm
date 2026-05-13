import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getArticles,
  getArticleById,
  searchArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../controllers/kbController';

const router = Router();

router.use(authMiddleware);

// /search must be registered before /:id — otherwise Express treats "search" as the :id param
router.get('/search', searchArticles);

router.get('/', getArticles);
router.get('/:id', getArticleById);
router.post('/', requireRole('support_agent', 'admin'), createArticle);
router.patch('/:id', requireRole('support_agent', 'admin'), updateArticle);
router.delete('/:id', requireRole('admin'), deleteArticle);

export default router;
