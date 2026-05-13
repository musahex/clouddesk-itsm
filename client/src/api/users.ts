import http from './http';
import { Assignee } from '../types/user';

export async function getAssignees(): Promise<Assignee[]> {
  const { data } = await http.get<Assignee[]>('/users/assignees');
  return data;
}
