import { connectToDatabase } from '@/lib/mongodb';
import { destroySession, getSessionUser, verifyPassword } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import CalendarImage from '@/models/CalendarImage';
import Session from '@/models/Session';
import Task from '@/models/Task';
import User from '@/models/User';

// GET /api/auth/me - 현재 로그인한 사용자
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json({ user });
  } catch (error) {
    return handleApiError(error, '로그인 정보를 확인하지 못했습니다.');
  }
}

// DELETE /api/auth/me - 회원 탈퇴 (비밀번호 재확인 후 계정·과제·배경 사진·세션 모두 삭제)
export async function DELETE(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const body = await request.json().catch(() => null);
    await connectToDatabase();
    const user = await User.findById(sessionUser.id);
    if (!user || !(await verifyPassword(String(body?.password ?? ''), user.password_hash))) {
      return jsonError('비밀번호가 올바르지 않습니다.', 403, 'INVALID_CREDENTIALS');
    }

    await Task.deleteMany({ owner: sessionUser.id });
    await CalendarImage.deleteOne({ user: user._id });
    await destroySession();
    await Session.deleteMany({ user: user._id });
    await user.deleteOne();
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '회원 탈퇴에 실패했습니다.');
  }
}
