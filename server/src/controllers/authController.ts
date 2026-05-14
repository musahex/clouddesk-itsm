import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { validatePassword } from '../utils/validatePassword';
import { env } from '../config/env';

function generateToken(id: string, role: string, name: string): string {
  return jwt.sign({ id, role, name }, env.jwtSecret, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response): Promise<void> {
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
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ message: 'An account with that email already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    // Role is always requester for public registration — ignored from request body
    const user = await User.create({ name, email, password: hashed, role: 'requester' });

    const token = generateToken(user.id, user.role, user.name);

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(500).json({ message: 'Server error during registration' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.role, user.name);

    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(500).json({ message: 'Server error during login' });
  }
}
