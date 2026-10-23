import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser {
  username: string; // 로그인 아이디 (소문자로 저장)
  nickname: string; // 화면에 표시할 이름
  password_hash: string; // scrypt로 암호화한 비밀번호 (원문은 저장하지 않음)
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
  },
  { timestamps: true }
);

const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', UserSchema);

export default User;
