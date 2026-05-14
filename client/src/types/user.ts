import { UserRole } from './auth';

export interface Assignee {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CreateSupportAgentPayload {
  name: string;
  email: string;
  password: string;
}

export interface CreatedSupportAgent {
  id: string;
  name: string;
  email: string;
  role: 'support_agent';
}
