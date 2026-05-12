import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Ticket, { TicketCategory, TicketPriority, TicketStatus } from '../models/Ticket';
import User from '../models/User';

const VALID_CATEGORIES: TicketCategory[] = [
  'Hardware',
  'Software',
  'Access Request',
  'Network',
  'Cloud',
  'Application Issue',
  'General Support',
];

const VALID_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

const VALID_STATUSES: TicketStatus[] = [
  'New',
  'Assigned',
  'In Progress',
  'Escalated',
  'Resolved',
  'Closed',
];

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const { title, description, category, priority } = req.body;

  if (!title || !description || !category) {
    res.status(400).json({ message: 'Title, description, and category are required' });
    return;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    return;
  }

  try {
    const ticket = await Ticket.create({
      title,
      description,
      category,
      priority: priority || 'Medium',
      status: 'New',
      requester: req.user!.id,
    });

    await ticket.populate('requester', 'name email role');

    res.status(201).json(ticket);
  } catch {
    res.status(500).json({ message: 'Server error creating ticket' });
  }
}

export async function getTickets(req: Request, res: Response): Promise<void> {
  try {
    const filter = req.user!.role === 'requester' ? { requester: req.user!.id } : {};

    const tickets = await Ticket.find(filter)
      .populate('requester', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch {
    res.status(500).json({ message: 'Server error fetching tickets' });
  }
}

export async function getTicketById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Ticket not found' });
    return;
  }

  try {
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (req.user!.role === 'requester' && ticket.requester.toString() !== req.user!.id) {
      res.status(403).json({ message: 'Forbidden: you do not own this ticket' });
      return;
    }

    await ticket.populate([
      { path: 'requester', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'comments.author', select: 'name email role' },
    ]);

    res.json(ticket);
  } catch {
    res.status(500).json({ message: 'Server error fetching ticket' });
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ message: 'Status is required' });
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Ticket not found' });
    return;
  }

  try {
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    ticket.status = status;
    ticket.resolvedAt = status === 'Resolved' ? new Date() : null;

    await ticket.save();

    await ticket.populate([
      { path: 'requester', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
    ]);

    res.json(ticket);
  } catch {
    res.status(500).json({ message: 'Server error updating status' });
  }
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { body, isInternal } = req.body;

  if (!body) {
    res.status(400).json({ message: 'Comment body is required' });
    return;
  }

  if (!isValidId(id)) {
    res.status(404).json({ message: 'Ticket not found' });
    return;
  }

  try {
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    const isRequester = req.user!.role === 'requester';

    if (isRequester && ticket.requester.toString() !== req.user!.id) {
      res.status(403).json({ message: 'Forbidden: you do not own this ticket' });
      return;
    }

    // Requesters cannot post internal notes
    const internal = isRequester ? false : Boolean(isInternal);

    const updated = await Ticket.findByIdAndUpdate(
      id,
      {
        $push: {
          comments: {
            body,
            author: new mongoose.Types.ObjectId(req.user!.id),
            isInternal: internal,
          },
        },
      },
      { new: true }
    )
      .populate('requester', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('comments.author', 'name email role');

    res.status(201).json(updated);
  } catch {
    res.status(500).json({ message: 'Server error adding comment' });
  }
}

export async function assignTicket(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    res.status(400).json({ message: 'assignedTo user ID is required' });
    return;
  }

  if (!isValidId(id) || !isValidId(assignedTo)) {
    res.status(400).json({ message: 'Invalid ID format' });
    return;
  }

  try {
    const [ticket, assignee] = await Promise.all([
      Ticket.findById(id),
      User.findById(assignedTo),
    ]);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (!assignee) {
      res.status(404).json({ message: 'Assignee user not found' });
      return;
    }

    if (!['support_agent', 'admin'].includes(assignee.role)) {
      res
        .status(400)
        .json({ message: 'Tickets can only be assigned to support agents or admins' });
      return;
    }

    ticket.assignedTo = new mongoose.Types.ObjectId(assignedTo);

    // Auto-advance status from New → Assigned on first assignment
    if (ticket.status === 'New') {
      ticket.status = 'Assigned';
    }

    await ticket.save();

    await ticket.populate([
      { path: 'requester', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
    ]);

    res.json(ticket);
  } catch {
    res.status(500).json({ message: 'Server error assigning ticket' });
  }
}
