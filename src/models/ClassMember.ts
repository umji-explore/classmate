import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// 클래스 참여자 (클래스장 본인도 role: 'owner'로 들어 있음)
export interface IClassMember {
  classroom: Types.ObjectId;
  user: Types.ObjectId;
  role: 'owner' | 'member';
  last_read_at: Date; // 이 시각 이후에 올라온 공지는 '새 공지'로 표시
}

export interface IClassMemberDocument extends IClassMember, Document {}

const ClassMemberSchema = new Schema<IClassMemberDocument>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
    last_read_at: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// 같은 사람이 같은 클래스에 두 번 들어가지 않게
ClassMemberSchema.index({ classroom: 1, user: 1 }, { unique: true });

const ClassMember: Model<IClassMemberDocument> =
  mongoose.models.ClassMember ?? mongoose.model<IClassMemberDocument>('ClassMember', ClassMemberSchema);

export default ClassMember;
