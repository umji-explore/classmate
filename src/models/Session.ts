import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISession {
  token_hash: string; // 쿠키에 담긴 토큰의 SHA-256 해시 (DB가 유출돼도 토큰을 알 수 없게)
  user: Types.ObjectId;
  expires_at: Date;
}

export interface ISessionDocument extends ISession, Document {}

const SessionSchema = new Schema<ISessionDocument>(
  {
    token_hash: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 만료 시간이 지나면 MongoDB가 자동으로 삭제 (TTL 인덱스)
    expires_at: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

const Session: Model<ISessionDocument> =
  mongoose.models.Session ?? mongoose.model<ISessionDocument>('Session', SessionSchema);

export default Session;
