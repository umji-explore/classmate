import { after } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { getMembership, notifyNewAnnouncement, readNotice } from '@/lib/classroom';
import type { AnnouncementItem } from '@/lib/classes';
import Announcement from '@/models/Announcement';

// POST /api/classes/[id]/announcements - 공지 올리기 (클래스장만) → 모든 참여자에게 알림
export async function POST(request: Request, ctx: RouteContext<'/api/classes/[id]/announcements'>) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    await connectToDatabase();

    const m = await getMembership(id, user.id);
    if (!m) return jsonError('클래스를 찾을 수 없거나 참여하지 않은 클래스예요.', 404, 'NOT_FOUND');
    if (!m.isOwner) return jsonError('공지는 클래스장만 올릴 수 있어요.', 403, 'FORBIDDEN');

    const input = readNotice(await request.json());
    if (typeof input === 'string') return jsonError(input, 400, 'VALIDATION');

    const notice = await Announcement.create({ classroom: id, author: user.id, ...input });

    // 응답을 먼저 보내고, 학생들 기기로 알림 보내기는 뒤에서 처리
    const classroom = { _id: m.classroom._id, name: m.classroom.name };
    after(() => notifyNewAnnouncement(classroom, notice, user.id).catch((e) => console.error('공지 알림 실패', e)));

    const item: AnnouncementItem = {
      id: String(notice._id),
      title: notice.title,
      body: notice.body,
      pinned: notice.pinned,
      author_name: user.nickname,
      created_at: notice.createdAt.toISOString(),
      updated_at: notice.updatedAt.toISOString(),
      is_new: false,
    };
    return Response.json({ announcement: item }, { status: 201 });
  } catch (error) {
    return handleApiError(error, '공지를 올리지 못했습니다.');
  }
}
