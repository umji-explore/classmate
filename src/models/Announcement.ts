import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// 클래스 공지사항 — 클래스장이 올리면 그 클래스의 모든 참여자가 본다
export interface IAnnouncement {
  classroom: Types.ObjectId;
  author: Types.ObjectId;
  title: string;
  body: string;
  pinned: boolean; // 상단 고정
}

export interface IAnnouncementDocument extends IAnnouncement, Document {
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncementDocument>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ classroom: 1, createdAt: -1 });

const Announcement: Model<IAnnouncementDocument> =
  mongoose.models.Announcement ?? mongoose.model<IAnnouncementDocument>('Announcement', AnnouncementSchema);

export default Announcement;
