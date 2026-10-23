import mongoose, { Schema, Document, Model } from 'mongoose';

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'normal' | 'high';
export type TaskKind = '과제' | '수행평가' | '시험' | '학교 행사' | '개인 일정';
export type TaskSubject = '국어' | '수학' | '영어' | '과학' | '사회' | '정보' | '기타';

export interface ITask {
  owner: string; // 이 과제를 만든 사용자(User)의 _id
  title: string;
  subject: TaskSubject;
  kind: TaskKind;
  due_date: string; // YYYY-MM-DD
  estimated_minutes: number;
  status: TaskStatus;
  priority: TaskPriority;
  notes: string;
  completed_at: string | null; // YYYY-MM-DD
}

export interface ITaskDocument extends ITask, Document {}

const TaskSchema = new Schema<ITaskDocument>(
  {
    owner: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 100, trim: true },
    subject: {
      type: String,
      required: true,
      enum: ['국어', '수학', '영어', '과학', '사회', '정보', '기타'],
    },
    kind: {
      type: String,
      required: true,
      enum: ['과제', '수행평가', '시험', '학교 행사', '개인 일정'],
    },
    due_date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    estimated_minutes: { type: Number, default: 30, min: 0, max: 1440 },
    status: {
      type: String,
      enum: ['todo', 'doing', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    notes: { type: String, default: '', maxlength: 500 },
    completed_at: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  {
    timestamps: true,
  }
);

const Task: Model<ITaskDocument> =
  mongoose.models.Task ?? mongoose.model<ITaskDocument>('Task', TaskSchema);

export default Task;
