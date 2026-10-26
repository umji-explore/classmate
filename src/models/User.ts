import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser {
  username: string; // 로그인 아이디 (소문자로 저장)
  nickname: string; // 화면에 표시할 이름
  password_hash: string; // scrypt 해시 (로그인 확인용, 되돌릴 수 없음)
  password_enc?: string; // 비밀번호 찾기용 AES-256-GCM 암호화 사본 (열쇠는 환경 변수에만 있음)
  recovery_code?: string; // 비밀번호 찾기용 고유 코드 (영문 대문자+숫자 6자리, 계정마다 다름)
  reset_failed_count: number; // 비밀번호 찾기 연속 실패 횟수
  reset_locked_until: Date | null; // 실패가 많을 때 비밀번호 찾기를 잠시 막는 시각
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]{4,20}$/,
    },
    nickname: { type: String, required: true, trim: true, maxlength: 20 },
    password_hash: { type: String, required: true },
    password_enc: { type: String },
    // unique: 다른 계정과 절대 겹치지 않도록 DB 차원에서 보장
    // sparse: 코드가 아직 없는 예전 계정이 여러 개 있어도 충돌하지 않게
    recovery_code: { type: String, unique: true, sparse: true, match: /^[A-Z0-9]{6}$/ },
    reset_failed_count: { type: Number, default: 0 },
    reset_locked_until: { type: Date, default: null },
  },
  { timestamps: true }
);

const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', UserSchema);

export default User;
