import { UserRole } from './auth';

export type KBCategory =
  | 'Hardware'
  | 'Software'
  | 'Access Request'
  | 'Network'
  | 'Cloud'
  | 'Application Issue'
  | 'General Support';

export interface KBAuthor {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface KnowledgeArticle {
  _id: string;
  title: string;
  content: string;
  category: KBCategory;
  tags: string[];
  author: KBAuthor;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticlePayload {
  title: string;
  content: string;
  category: KBCategory;
  tags: string[];
  isPublished: boolean;
}

export interface UpdateArticlePayload {
  title?: string;
  content?: string;
  category?: KBCategory;
  tags?: string[];
  isPublished?: boolean;
}

export const KB_CATEGORIES: KBCategory[] = [
  'Hardware',
  'Software',
  'Access Request',
  'Network',
  'Cloud',
  'Application Issue',
  'General Support',
];
