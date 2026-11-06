import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { deleteClassroom, getMembership, summarizeClass, withUniqueClassCode } from '@/lib/classroom';
import { AnnouncementItem, CLASS_DESC_MAX, CLASS_NAME_MAX, ClassDetail, MemberItem } from '@/lib/classes';
import Announcement from '@/models/Announcement';
import Classroom from '@/models/Classroom';
import ClassMember from '@/models/ClassMember';
import User from '@/models/User';

const notFound = () => jsonError('클래스를 찾을 수 없거나 참여하지 않은 클래스예요.', 404, 'NOT_FOUND');
const ownerOnly = () => jsonError('클래스장만 할 수 있어요.', 403, 'FORBIDDEN');

// GET /api/classes/[id] - 클래스 정보 + 공지 목록 (+ 클래스장에게는 참여자 목록). 본 시각을 기록한다.
export async function GET(_request: Request, ctx: RouteContext<'/api/classes/[id]'>) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    await connectToDatabase();

    const m = await getMembership(id, user.id);
    if (!m) return notFound();
    const lastRead = m.member.last_read_at;

    const notices = await Announcement.find({ classroom: id }).sort({ pinned: -1, createdAt: -1 }).limit(100).lean();
    const authorIds = [...new Set(notices.map((n) => String(n.author)))];
    const authors = new Map(
      (await User.find({ _id: { $in: authorIds } }).select('nickname').lean()).map((u) => [String(u._id), u.nickname])
    );
    const announcements: AnnouncementItem[] = notices.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      author_name: authors.get(String(n.author)) ?? '(알 수 없음)',
      created_at: n.createdAt.toISOString(),
      updated_at: n.updatedAt.toISOString(),
      is_new: n.createdAt > lastRead && String(n.author) !== user.id,
    }));

    let members: MemberItem[] | null = null;
    if (m.isOwner) {
      const rows = await ClassMember.find({ classroom: id }).sort({ role: -1, createdAt: 1 }).lean();
      const users = new Map(
        (await User.find({ _id: { $in: rows.map((r) => r.user) } }).select('nickname username').lean()).map((u) => [String(u._id), u])
      );
      members = rows
        .filter((r) => users.has(String(r.user)))
        .map((r) => ({
          user_id: String(r.user),
          nickname: users.get(String(r.user))!.nickname,
          username: users.get(String(r.user))!.username,
          role: r.role,
          joined_at: (r as unknown as { createdAt: Date }).createdAt.toISOString(),
        }));
    }

    // 지금 다 봤으므로 읽은 시각을 갱신 (요약의 '새 공지 수'는 갱신 전 기준으로 계산)
    const summary = await summarizeClass(m.classroom, m.member, user.id);
    await ClassMember.updateOne({ _id: m.member._id }, { $set: { last_read_at: new Date() } });

    const detail: ClassDetail = { class: { ...summary, unread: 0 }, announcements, members };
    return Response.json(detail);
  } catch (error) {
    return handleApiError(error, '클래스를 불러오지 못했습니다.');
  }
}

// PATCH /api/classes/[id] - 이름·소개 바꾸기, 참여 코드 새로 만들기 (클래스장만)
export async function PATCH(request: Request, ctx: RouteContext<'/api/classes/[id]'>) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    await connectToDatabase();

    const m = await getMembership(id, user.id);
    if (!m) return notFound();
    if (!m.isOwner) return ownerOnly();

    const body = await request.json();
    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > CLASS_NAME_MAX) return jsonError(`클래스 이름은 1~${CLASS_NAME_MAX}자로 입력해 주세요.`, 400, 'VALIDATION');
      m.classroom.name = name;
    }
    if (body?.description !== undefined) {
      const description = String(body.description).trim();
      if (description.length > CLASS_DESC_MAX) return jsonError(`소개는 ${CLASS_DESC_MAX}자까지 쓸 수 있어요.`, 400, 'VALIDATION');
      m.classroom.description = description;
    }
    await m.classroom.save();

    // 코드가 다른 사람에게 퍼졌을 때: 새 코드로 바꾸면 예전 코드로는 더 이상 들어올 수 없다 (이미 들어온 사람은 그대로)
    if (body?.regenerate_code === true) {
      await withUniqueClassCode((code) => Classroom.updateOne({ _id: m.classroom._id }, { $set: { code } }));
    }

    const classroom = await Classroom.findById(id);
    return Response.json({ class: await summarizeClass(classroom!, m.member, user.id) });
  } catch (error) {
    return handleApiError(error, '클래스 정보를 바꾸지 못했습니다.');
  }
}

// DELETE /api/classes/[id] - 클래스 삭제 (클래스장만, 공지·참여자 모두 삭제)
export async function DELETE(_request: Request, ctx: RouteContext<'/api/classes/[id]'>) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    await connectToDatabase();

    const m = await getMembership(id, user.id);
    if (!m) return notFound();
    if (!m.isOwner) return ownerOnly();

    await deleteClassroom(m.classroom._id);
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '클래스를 삭제하지 못했습니다.');
  }
}
