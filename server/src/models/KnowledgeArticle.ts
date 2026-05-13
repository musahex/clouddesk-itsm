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

export default mongoose.model<IKnowledgeArticle>('KnowledgeArticle', knowledgeArticleSchema);
