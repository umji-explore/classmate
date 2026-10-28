import mongoose, { Schema, Document, Model } from 'mongoose';

// 사용자가 올린 달력 배경 사진 (사용자당 1장, 브라우저에서 줄여서 올린 이미지)
export interface ICalendarImage {
  user: mongoose.Types.ObjectId;
  data: Buffer;
  content_type: string;
}

export interface ICalendarImageDocument extends ICalendarImage, Document {}

const CalendarImageSchema = new Schema<ICalendarImageDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    data: { type: Buffer, required: true },
    content_type: { type: String, required: true },
  },
  { timestamps: true }
);

const CalendarImage: Model<ICalendarImageDocument> =
  mongoose.models.CalendarImage ?? mongoose.model<ICalendarImageDocument>('CalendarImage', CalendarImageSchema);

export default CalendarImage;
