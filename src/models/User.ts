import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser {
  username: string; // 로그인 아이디 (소문자로 저장)
  nickname: string; // 화면에 표시할 이름
  email?: string; // 비밀번호 찾기 메일을 받을 주소 (이메일 기능 전에 가입한 계정은 없을 수 있음)
  password_hash: string; // scrypt 해시 (로그인 확인용, 되돌릴 수 없음)
  // 비밀번호 찾기로 이메일에 보낸 임시 비밀번호 (해시만 저장, 유효 시간 동안 원래 비밀번호와 함께 사용 가능)
  temp_password_hash: string | null;
  temp_password_expires_at: Date | null;
  reset_email_sent_at: Date | null; // 마지막으로 비밀번호 찾기 메일을 보낸 시각 (연속 발송 방지)
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
    email: { type: String, lowercase: true, trim: true, maxlength: 100, match: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ },
    password_hash: { type: String, required: true },
    temp_password_hash: { type: String, default: null },
    temp_password_expires_at: { type: Date, default: null },
    reset_email_sent_at: { type: Date, default: null },
    reset_failed_count: { type: Number, default: 0 },
    reset_locked_until: { type: Date, default: null },
  },
  { timestamps: true }
);

const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', UserSchema);

export default User;
