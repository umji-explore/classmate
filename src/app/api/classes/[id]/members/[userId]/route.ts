import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { getMembership } from '@/lib/classroom';
import ClassMember from '@/models/ClassMember';

// DELETE /api/classes/[id]/members/[userId]
// - userId가 'me'(또는 내 ID): 클래스에서 나가기 (클래스장은 나갈 수 없고 클래스를 삭제해야 함)
// - 다른 사람 ID: 클래스장이 참여자를 내보내기
export async function DELETE(_request: Request, ctx: RouteContext<'/api/classes/[id]/members/[userId]'>) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id, userId } = await ctx.params;
    await connectToDatabase();

    const m = await getMembership(id, user.id);
    if (!m) return jsonError('클래스를 찾을 수 없거나 참여하지 않은 클래스예요.', 404, 'NOT_FOUND');

    const targetId = userId === 'me' ? user.id : userId;
    if (targetId === user.id) {
      if (m.isOwner) return jsonError('클래스장은 나갈 수 없어요. 클래스를 삭제해 주세요.', 400, 'OWNER_CANNOT_LEAVE');
      await ClassMember.deleteOne({ _id: m.member._id });
      return Response.json({ success: true });
    }

    if (!m.isOwner) return jsonError('클래스장만 할 수 있어요.', 403, 'FORBIDDEN');
    if (!mongoose.isValidObjectId(targetId)) return jsonError('참여자를 찾을 수 없어요.', 404, 'NOT_FOUND');
    const { deletedCount } = await ClassMember.deleteOne({ classroom: id, user: targetId, role: 'member' });
    if (!deletedCount) return jsonError('참여자를 찾을 수 없어요.', 404, 'NOT_FOUND');
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '처리하지 못했습니다.');
  }
}
