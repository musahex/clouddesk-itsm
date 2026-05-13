import { UserRole } from './auth';

export interface Assignee {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}
