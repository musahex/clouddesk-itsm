import { Request, Response } from 'express';
import User from '../models/User';

export async function getAssignees(req: Request, res: Response): Promise<void> {
  try {
    const assignees = await User.find(
      { role: { $in: ['support_agent', 'admin'] } },
      'name email role'
    ).sort({ name: 1 });

    res.json(assignees);
  } catch {
    res.status(500).json({ message: 'Server error fetching assignees' });
  }
}
