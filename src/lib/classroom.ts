// 공동체용 클래스 서버 헬퍼 (참여 코드 발급, 참여 여부 확인, 공지 알림)
import { randomInt } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { isDuplicateKeyError } from '@/lib/auth';
import { sendToUser } from '@/lib/push';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, type ClassSummary } from '@/lib/classes';
import Announcement from '@/models/Announcement';
import Classroom, { IClassroomDocument } from '@/models/Classroom';
import ClassMember, { IClassMemberDocument } from '@/models/ClassMember';
import User from '@/models/User';

export const MAX_OWNED_CLASSES = 30; // 한 사람이 만들 수 있는 클래스 수
export const MAX_JOINED_CLASSES = 50; // 한 사람이 참여할 수 있는 클래스 수
export const MAX_MEMBERS = 300; // 한 클래스의 최대 인원 (클래스장 포함)
export const JOIN_MAX_FAILS = 10; // 틀린 코드를 이만큼 넣으면
export const JOIN_LOCK_MINUTES = 15; // 이 시간 동안 참여를 막는다

// ── 참여 코드 ────────────────────────────────────────────────────
// 헷갈리기 쉬운 글자(0/O, 1/I/L)는 빼고, 영문 대문자와 숫자가 반드시 하나 이상 섞인 6자리
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_DIGITS = '23456789';
const CODE_CHARS = CODE_LETTERS + CODE_DIGITS;
export const CLASS_CODE_RULE = /^[A-Z0-9]{6}$/;

export function generateClassCode(): string {
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (/[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}

export const normalizeClassCode = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();

// 겹치지 않는 코드로 저장한다. 미리 확인하고, 그래도 동시에 같은 코드가 나와
// DB의 unique 인덱스에 걸리면 새 코드로 다시 시도한다. (save는 코드를 넣어 저장하는 함수)
export async function withUniqueClassCode<T>(save: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateClassCode();
    if (await Classroom.exists({ code })) continue;
    try {
      return await save(code);
    } catch (error) {
      if (!isDuplicateKeyError(error, 'code')) throw error;
    }
  }
  throw new Error('참여 코드를 만들지 못했습니다.');
}

// ── 참여 여부 ────────────────────────────────────────────────────
export interface Membership {
  classroom: IClassroomDocument;
  member: IClassMemberDocument;
  isOwner: boolean;
}

// 이 사용자가 참여한 클래스면 클래스와 참여 정보를, 아니면 null (없는 클래스와 구분하지 않음)
export async function getMembership(classId: string, userId: string): Promise<Membership | null> {
  if (!mongoose.isValidObjectId(classId)) return null;
  const [classroom, member] = await Promise.all([
    Classroom.findById(classId),
    ClassMember.findOne({ classroom: classId, user: userId }),
  ]);
  if (!classroom || !member) return null;
  return { classroom, member, isOwner: String(classroom.owner) === userId };
}

// ── 공지 알림 ────────────────────────────────────────────────────
// 클래스장을 뺀 모든 참여자의 기기로 푸시 알림 (알림을 켠 기기에만 간다)
type Id = Types.ObjectId | string;

export async function notifyNewAnnouncement(
  classroom: { _id: Id; name: string },
  announcement: { _id: Id; title: string; body: string },
  authorId: string
) {
  const members = await ClassMember.find({ classroom: classroom._id, user: { $ne: authorId } }).select('user').lean();
  const body = announcement.body ? `${announcement.title}\n${announcement.body}` : announcement.title;
  const message = {
    title: `[${classroom.name}] 새 공지`,
    body: body.length > 120 ? body.slice(0, 117) + '…' : body,
    url: `/?page=classes&class=${String(classroom._id)}`,
    tag: `class-${String(announcement._id)}`,
  };
  // 인원이 많아도 한꺼번에 몰리지 않게 20명씩 나눠 보낸다
  for (let i = 0; i < members.length; i += 20) {
    await Promise.all(members.slice(i, i + 20).map((m) => sendToUser(String(m.user), message).catch(() => 0)));
  }
}

// ── 응답용 요약 ─────────────────────────────────────────────────
type ClassLike = { _id: Id; name: string; description?: string; code: string; owner: Id };
type MemberLike = { role: 'owner' | 'member'; last_read_at: Date };

export async function summarizeClass(classroom: ClassLike, member: MemberLike, userId: string): Promise<ClassSummary> {
  const [owner, memberCount, unread, latest] = await Promise.all([
    User.findById(classroom.owner).select('nickname').lean(),
    ClassMember.countDocuments({ classroom: classroom._id }),
    Announcement.countDocuments({ classroom: classroom._id, createdAt: { $gt: member.last_read_at }, author: { $ne: userId } }),
    Announcement.findOne({ classroom: classroom._id }).sort({ createdAt: -1 }).select('title createdAt').lean(),
  ]);
  const isOwner = member.role === 'owner';
  return {
    id: String(classroom._id),
    name: classroom.name,
    description: classroom.description ?? '',
    role: member.role,
    owner_name: owner?.nickname ?? '(알 수 없음)',
    member_count: memberCount,
    unread,
    latest: latest ? { title: latest.title, created_at: latest.createdAt.toISOString() } : null,
    code: isOwner ? classroom.code : null,
  };
}

// 클래스와 그 안의 참여자·공지를 모두 지운다
export async function deleteClassroom(classId: Id) {
  await Announcement.deleteMany({ classroom: classId });
  await ClassMember.deleteMany({ classroom: classId });
  await Classroom.deleteOne({ _id: classId });
}

// 회원 탈퇴 시: 내가 만든 클래스는 통째로 지우고, 참여한 클래스에서는 나간다
export async function deleteUserClassData(userId: Id) {
  const owned = await Classroom.find({ owner: userId }).select('_id').lean();
  for (const c of owned) await deleteClassroom(c._id);
  await ClassMember.deleteMany({ user: userId });
}

// 공지 입력값 검사 (올리기·수정 공통). 잘못되면 에러 문구를 돌려준다
export function readNotice(body: unknown): { title: string; body: string; pinned: boolean } | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = String(b.title ?? '').trim();
  const text = String(b.body ?? '').trim();
  if (!title || title.length > NOTICE_TITLE_MAX) return `제목은 1~${NOTICE_TITLE_MAX}자로 입력해 주세요.`;
  if (text.length > NOTICE_BODY_MAX) return `내용은 ${NOTICE_BODY_MAX}자까지 쓸 수 있어요.`;
  return { title, body: text, pinned: b.pinned === true };
}
