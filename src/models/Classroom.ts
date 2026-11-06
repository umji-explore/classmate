import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// 공동체용 클래스(방) — 선생님(클래스장)이 만들고, 학생들은 참여 코드로 들어온다
export interface IClassroom {
  name: string;
  description: string;
  code: string; // 참여 코드: 영문 대문자+숫자 6자리, 클래스마다 하나이며 절대 겹치지 않음
  owner: Types.ObjectId; // 클래스장(선생님)
}

export interface IClassroomDocument extends IClassroom, Document {}

const ClassroomSchema = new Schema<IClassroomDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    // unique: 다른 클래스와 코드가 겹치지 않도록 DB 차원에서 보장
    code: { type: String, required: true, unique: true, match: /^[A-Z0-9]{6}$/ },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

const Classroom: Model<IClassroomDocument> =
  mongoose.models.Classroom ?? mongoose.model<IClassroomDocument>('Classroom', ClassroomSchema);

export default Classroom;
