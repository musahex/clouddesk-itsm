import mongoose, { Document, Schema, Types } from 'mongoose';

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

export interface IComment {
  _id?: Types.ObjectId;
  body: string;
  author: Types.ObjectId;
  isInternal: boolean;
  createdAt: Date;
}

export interface ITicket extends Document {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: Types.ObjectId;
  assignedTo?: Types.ObjectId | null;
  comments: IComment[];
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    body: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new Schema<ITicket>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'Hardware',
        'Software',
        'Access Request',
        'Network',
        'Cloud',
        'Application Issue',
        'General Support',
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['New', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed'],
      default: 'New',
    },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    comments: { type: [commentSchema], default: [] },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Role-scoped ticket list and dashboard aggregate queries for requesters
ticketSchema.index({ requester: 1, createdAt: -1 });

// Ticket list filtered by status, sorted by date (dashboard counts + agent list view)
ticketSchema.index({ status: 1, createdAt: -1 });

// Agent's assigned tickets filtered by status
ticketSchema.index({ assignedTo: 1, status: 1 });

// Dashboard priority/status breakdown counts (e.g. critical open tickets)
ticketSchema.index({ priority: 1, status: 1 });

export default mongoose.model<ITicket>('Ticket', ticketSchema);
