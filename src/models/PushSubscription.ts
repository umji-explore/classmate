import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// 푸시 알림을 받을 브라우저·기기 (한 사용자가 여러 기기에서 알림을 켤 수 있음)
export interface IPushSubscription {
  user: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface IPushSubscriptionDocument extends IPushSubscription, Document {}

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 },
    },
  },
  { timestamps: true }
);

const PushSubscription: Model<IPushSubscriptionDocument> =
  mongoose.models.PushSubscription ??
  mongoose.model<IPushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema);

export default PushSubscription;
