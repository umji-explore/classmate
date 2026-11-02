import mongoose, { Schema, Document, Model } from 'mongoose';

// 나이스에서 받아온 학사일정·시간표를 잠시 저장해 두는 곳 (같은 학교 학생끼리 공유, 만료되면 자동 삭제)
export interface ISchoolCache {
  key: string; // 예: sched:B10:7010083:202611, tt:B10:7010083:1:3:202611
  data: unknown;
  expires_at: Date;
}

export interface ISchoolCacheDocument extends ISchoolCache, Document {}

const SchoolCacheSchema = new Schema<ISchoolCacheDocument>({
  key: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, default: null },
  // 만료 시간이 지나면 MongoDB가 자동으로 삭제 (TTL 인덱스)
  expires_at: { type: Date, required: true, index: { expires: 0 } },
});

const SchoolCache: Model<ISchoolCacheDocument> =
  mongoose.models.SchoolCache ?? mongoose.model<ISchoolCacheDocument>('SchoolCache', SchoolCacheSchema);

export default SchoolCache;
