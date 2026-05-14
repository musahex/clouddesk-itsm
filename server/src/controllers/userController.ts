import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { validatePassword } from '../utils/validatePassword';

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

export async function createSupportAgent(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required' });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(400).json({ message: 'An account with that email already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    // Role is always support_agent — ignored from request body
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role: 'support_agent',
    });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(500).json({ message: 'Server error creating support agent' });
  }
}
