import { UserRole } from './auth';

export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Access Request'
  | 'Network'
  | 'Cloud'
  | 'Application Issue'
  | 'General Support';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Escalated'
  | 'Resolved'
  | 'Closed';

// Populated user shape returned by Mongoose populate in ticket responses
export interface TicketUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TicketComment {
  _id: string;
  body: string;
  author: TicketUser;
  isInternal: boolean;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: TicketUser;
  assignedTo?: TicketUser | null;
  comments: TicketComment[];
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface UpdateStatusPayload {
  status: TicketStatus;
}

export interface AddCommentPayload {
  body: string;
  isInternal?: boolean;
}

export interface AssignTicketPayload {
  assignedTo: string;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  'Hardware',
  'Software',
  'Access Request',
  'Network',
  'Cloud',
  'Application Issue',
  'General Support',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export const TICKET_STATUSES: TicketStatus[] = [
  'New',
  'Assigned',
  'In Progress',
  'Escalated',
  'Resolved',
  'Closed',
];
