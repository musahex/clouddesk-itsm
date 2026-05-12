import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'requester' | 'support_agent' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['requester', 'support_agent', 'admin'],
      default: 'requester',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);
