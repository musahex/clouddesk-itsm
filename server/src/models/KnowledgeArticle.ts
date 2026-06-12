import mongoose, { Document, Schema, Types } from 'mongoose';

export type KBCategory =
  | 'Hardware'
  | 'Software'
  | 'Access Request'
  | 'Network'
  | 'Cloud'
  | 'Application Issue'
  | 'General Support';

export interface IKnowledgeArticle extends Document {
  title: string;
  content: string;
  category: KBCategory;
  tags: string[];
  author: Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeArticleSchema = new Schema<IKnowledgeArticle>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
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
    tags: { type: [String], default: [] },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Published article list sorted by date (default KB list view for all roles)
knowledgeArticleSchema.index({ isPublished: 1, createdAt: -1 });

// Published articles filtered by category (KB category filtering)
knowledgeArticleSchema.index({ isPublished: 1, category: 1 });

// Note: the search endpoint uses $regex on title/content and $in on tags.
// Regex queries require a collection scan regardless of index; no text index is added.

export default mongoose.model<IKnowledgeArticle>('KnowledgeArticle', knowledgeArticleSchema);
