import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Ticket, { TicketStatus, TicketPriority, TicketCategory } from '../models/Ticket';

const OPEN_STATUSES: TicketStatus[] = ['New', 'Assigned', 'In Progress', 'Escalated'];
const RESOLVED_STATUSES: TicketStatus[] = ['Resolved', 'Closed'];
const ALL_STATUSES: TicketStatus[] = [...OPEN_STATUSES, ...RESOLVED_STATUSES];
const ALL_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const ALL_CATEGORIES: TicketCategory[] = [
  'Hardware',
  'Software',
  'Access Request',
  'Network',
  'Cloud',
  'Application Issue',
  'General Support',
];

// Ensures every enum key appears in the response, defaulting to 0 if no tickets exist for it
function toCountMap(
  results: Array<{ _id: string; count: number }>,
  keys: string[]
): Record<string, number> {
  const map: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const { _id, count } of results) {
    if (_id in map) map[_id] = count;
  }
  return map;
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const isRequester = req.user!.role === 'requester';

  // ObjectId used here because aggregate $match does not auto-cast strings like find/countDocuments
  const baseFilter: mongoose.FilterQuery<typeof Ticket> = isRequester
    ? { requester: new mongoose.Types.ObjectId(req.user!.id) }
    : {};

  try {
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      criticalTickets,
      highPriorityTickets,
      statusCounts,
      priorityCounts,
      categoryCounts,
      recentTickets,
    ] = await Promise.all([
      Ticket.countDocuments(baseFilter),
      Ticket.countDocuments({ ...baseFilter, status: { $in: OPEN_STATUSES } }),
      Ticket.countDocuments({ ...baseFilter, status: { $in: RESOLVED_STATUSES } }),
      Ticket.countDocuments({ ...baseFilter, priority: 'Critical' }),
      Ticket.countDocuments({ ...baseFilter, priority: 'High' }),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate<{ _id: string; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Ticket.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('requester', 'name email role')
        .populate('assignedTo', 'name email role')
        .select('title status priority category requester assignedTo createdAt'),
    ]);

    res.json({
      totalTickets,
      openTickets,
      resolvedTickets,
      criticalTickets,
      highPriorityTickets,
      ticketsByStatus: toCountMap(statusCounts, ALL_STATUSES),
      ticketsByPriority: toCountMap(priorityCounts, ALL_PRIORITIES),
      ticketsByCategory: toCountMap(categoryCounts, ALL_CATEGORIES),
      recentTickets,
    });
  } catch {
    res.status(500).json({ message: 'Server error fetching dashboard metrics' });
  }
}
