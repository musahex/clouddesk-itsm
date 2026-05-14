import http from './http';
import { Assignee, CreateSupportAgentPayload, CreatedSupportAgent } from '../types/user';

export async function getAssignees(): Promise<Assignee[]> {
  const { data } = await http.get<Assignee[]>('/users/assignees');
  return data;
}

export async function createSupportAgent(
  payload: CreateSupportAgentPayload
): Promise<{ user: CreatedSupportAgent }> {
  const { data } = await http.post<{ user: CreatedSupportAgent }>(
    '/users/support-agents',
    payload
  );
  return data;
}
