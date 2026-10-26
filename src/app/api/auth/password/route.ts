import { connectToDatabase } from '@/lib/mongodb';
import {
  createSession, encryptPassword, getSessionUser, hashPassword, validatePassword, verifyPassword,
} from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import Session from '@/models/Session';
import User from '@/models/User';

// PUT /api/auth/password - 로그인한 상태에서 비밀번호 변경 (현재 비밀번호 확인)
export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const body = await request.json();
    const current = String(body?.current_password ?? '');
    const next = String(body?.new_password ?? '');

    const invalid = validatePassword(next);
    if (invalid) return jsonError(invalid, 400, 'VALIDATION');

    await connectToDatabase();
    const user = await User.findById(sessionUser.id);
    if (!user || !(await verifyPassword(current, user.password_hash))) {
      return jsonError('현재 비밀번호가 올바르지 않습니다.', 403, 'INVALID_CREDENTIALS');
    }

    user.password_hash = await hashPassword(next);
    user.password_enc = encryptPassword(next) ?? undefined;
    await user.save();

    // 다른 기기의 로그인은 끊고, 지금 기기는 새 세션으로 로그인 유지
    await Session.deleteMany({ user: user._id });
    await createSession(user._id);

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '비밀번호를 변경하지 못했습니다.');
  }
}
