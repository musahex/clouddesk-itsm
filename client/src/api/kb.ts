import http from './http';
import { KnowledgeArticle, CreateArticlePayload, UpdateArticlePayload, KBCategory } from '../types/kb';

export async function getArticles(includeUnpublished = false): Promise<KnowledgeArticle[]> {
  const { data } = await http.get<KnowledgeArticle[]>('/kb', {
    params: includeUnpublished ? { includeUnpublished: 'true' } : {},
  });
  return data;
}

export async function getArticleById(id: string): Promise<KnowledgeArticle> {
  const { data } = await http.get<KnowledgeArticle>(`/kb/${id}`);
  return data;
}

export async function searchArticles(params: {
  q?: string;
  category?: KBCategory;
  includeUnpublished?: boolean;
}): Promise<KnowledgeArticle[]> {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.category) query.category = params.category;
  if (params.includeUnpublished) query.includeUnpublished = 'true';
  const { data } = await http.get<KnowledgeArticle[]>('/kb/search', { params: query });
  return data;
}

export async function createArticle(payload: CreateArticlePayload): Promise<KnowledgeArticle> {
  const { data } = await http.post<KnowledgeArticle>('/kb', payload);
  return data;
}

export async function updateArticle(
  id: string,
  payload: UpdateArticlePayload
): Promise<KnowledgeArticle> {
  const { data } = await http.patch<KnowledgeArticle>(`/kb/${id}`, payload);
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  await http.delete(`/kb/${id}`);
}
