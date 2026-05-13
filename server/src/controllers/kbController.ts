import { Request, Response } from 'express';
import mongoose from 'mongoose';
import KnowledgeArticle, { KBCategory } from '../models/KnowledgeArticle';

const VALID_CATEGORIES: KBCategory[] = [
  'Hardware',
  'Software',
  'Access Request',
  'Network',
  'Cloud',
  'Application Issue',
  'General Support',
];

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function canSeeUnpublished(req: Request): boolean {
  return (
    (req.user!.role === 'support_agent' || req.user!.role === 'admin') &&
    req.query.includeUnpublished === 'true'
  );
}

export async function getArticles(req: Request, res: Response): Promise<void> {
  try {
    const filter = canSeeUnpublished(req) ? {} : { isPublished: true };

    const articles = await KnowledgeArticle.find(filter)
      .populate('author', 'name email role')
      .sort({ createdAt: -1 });

    res.json(articles);
  } catch {
    res.status(500).json({ message: 'Server error fetching articles' });
  }
}

export async function getArticleById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }

  try {
    const article = await KnowledgeArticle.findById(id).populate('author', 'name email role');

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    // Return 404 (not 403) for unpublished articles so requesters can't confirm existence
    if (!article.isPublished && req.user!.role === 'requester') {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    res.json(article);
  } catch {
    res.status(500).json({ message: 'Server error fetching article' });
  }
}

export async function searchArticles(req: Request, res: Response): Promise<void> {
  const { q, category, tags } = req.query;

  try {
    const filter: Record<string, unknown> = {};

    // Requesters only see published articles
    if (!canSeeUnpublished(req)) {
      filter.isPublished = true;
    }

    if (q && typeof q === 'string') {
      const regex = { $regex: q, $options: 'i' };
      filter.$or = [{ title: regex }, { content: regex }];
    }

    if (category && typeof category === 'string') {
      if (!VALID_CATEGORIES.includes(category as KBCategory)) {
        res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
        return;
      }
      filter.category = category;
    }

    if (tags && typeof tags === 'string') {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        filter.tags = { $in: tagList };
      }
    }

    const articles = await KnowledgeArticle.find(filter)
      .populate('author', 'name email role')
      .sort({ createdAt: -1 });

    res.json(articles);
  } catch {
    res.status(500).json({ message: 'Server error searching articles' });
  }
}

export async function createArticle(req: Request, res: Response): Promise<void> {
  const { title, content, category, tags, isPublished } = req.body;

  if (!title || !content || !category) {
    res.status(400).json({ message: 'Title, content, and category are required' });
    return;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    res.status(400).json({ message: 'Tags must be an array of strings' });
    return;
  }

  try {
    const article = await KnowledgeArticle.create({
      title,
      content,
      category,
      tags: tags ?? [],
      author: req.user!.id,
      isPublished: isPublished === true,
    });

    await article.populate('author', 'name email role');

    res.status(201).json(article);
  } catch {
    res.status(500).json({ message: 'Server error creating article' });
  }
}

export async function updateArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, content, category, tags, isPublished } = req.body;

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    res.status(400).json({ message: 'Tags must be an array of strings' });
    return;
  }

  if (isPublished !== undefined && typeof isPublished !== 'boolean') {
    res.status(400).json({ message: 'isPublished must be a boolean' });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    if (isPublished !== undefined) updates.isPublished = isPublished;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No valid fields provided for update' });
      return;
    }

    const article = await KnowledgeArticle.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate('author', 'name email role');

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    res.json(article);
  } catch {
    res.status(500).json({ message: 'Server error updating article' });
  }
}

export async function deleteArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }

  try {
    const article = await KnowledgeArticle.findByIdAndDelete(id);

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Server error deleting article' });
  }
}
