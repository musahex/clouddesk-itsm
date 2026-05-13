import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

dotenv.config();

const DEMO_USERS = [
  { name: 'Demo Requester', email: 'requester@clouddesk.dev', password: 'Password123!', role: 'requester' as const },
  { name: 'Demo Agent',     email: 'agent@clouddesk.dev',     password: 'Password123!', role: 'support_agent' as const },
  { name: 'Demo Admin',     email: 'admin@clouddesk.dev',     password: 'Password123!', role: 'admin' as const },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected\n');

  for (const demo of DEMO_USERS) {
    const existing = await User.findOne({ email: demo.email });
    if (existing) {
      console.log(`  skip   ${demo.email} (already exists)`);
      continue;
    }
    const hashed = await bcrypt.hash(demo.password, 10);
    await User.create({ name: demo.name, email: demo.email, password: hashed, role: demo.role });
    console.log(`  created ${demo.email} · ${demo.role}`);
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
