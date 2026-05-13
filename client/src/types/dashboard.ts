import { TicketStatus, TicketPriority, TicketCategory } from './ticket';
import { UserRole } from './auth';

export interface RecentTicket {
  _id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  requester: { _id: string; name: string; email: string; role: UserRole };
  assignedTo?: { _id: string; name: string; email: string; role: UserRole } | null;
  createdAt: string;
}

export interface DashboardData {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  criticalTickets: number;
  highPriorityTickets: number;
  ticketsByStatus: Record<TicketStatus, number>;
  ticketsByPriority: Record<TicketPriority, number>;
  ticketsByCategory: Record<TicketCategory, number>;
  recentTickets: RecentTicket[];
}
