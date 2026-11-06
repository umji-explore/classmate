import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { getMembership, readNotice } from '@/lib/classroom';
import Announcement from '@/models/Announcement';

type Ctx = RouteContext<'/api/classes/[id]/announcements/[aid]'>;

// 클래스장인지 확인하고 공지를 찾는다 (실패하면 에러 응답)
async function ownerNotice(ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized() };
  const { id, aid } = await ctx.params;
  await connectToDatabase();

  const m = await getMembership(id, user.id);
  if (!m) return { error: jsonError('클래스를 찾을 수 없거나 참여하지 않은 클래스예요.', 404, 'NOT_FOUND') };
  if (!m.isOwner) return { error: jsonError('공지는 클래스장만 고칠 수 있어요.', 403, 'FORBIDDEN') };
  if (!mongoose.isValidObjectId(aid)) return { error: jsonError('공지를 찾을 수 없어요.', 404, 'NOT_FOUND') };
  const notice = await Announcement.findOne({ _id: aid, classroom: id });
  if (!notice) return { error: jsonError('공지를 찾을 수 없어요.', 404, 'NOT_FOUND') };
  return { notice };
}

// PUT /api/classes/[id]/announcements/[aid] - 공지 수정 (클래스장만, 다시 알림은 보내지 않음)
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const r = await ownerNotice(ctx);
    if ('error' in r) return r.error;
    const input = readNotice(await request.json());
    if (typeof input === 'string') return jsonError(input, 400, 'VALIDATION');

    Object.assign(r.notice, input);
    await r.notice.save();
    return Response.json({ success: true, updated_at: r.notice.updatedAt.toISOString() });
  } catch (error) {
    return handleApiError(error, '공지를 수정하지 못했습니다.');
  }
}

// DELETE /api/classes/[id]/announcements/[aid] - 공지 삭제 (클래스장만)
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const r = await ownerNotice(ctx);
    if ('error' in r) return r.error;
    await r.notice.deleteOne();
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '공지를 삭제하지 못했습니다.');
  }
}
