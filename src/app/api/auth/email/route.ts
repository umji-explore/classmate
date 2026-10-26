import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser, normalizeEmail, toSessionUser, validateEmail, verifyPassword } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import User from '@/models/User';

// PUT /api/auth/email - 이메일 등록·변경 (비밀번호 확인)
// 이메일 기능이 생기기 전에 가입한 계정도 여기서 이메일을 등록해야 비밀번호 찾기를 쓸 수 있다.
export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ''));
    const password = String(body?.password ?? '');

    const invalid = validateEmail(email);
    if (invalid) return jsonError(invalid, 400, 'VALIDATION');

    await connectToDatabase();
    const user = await User.findById(sessionUser.id);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return jsonError('비밀번호가 올바르지 않습니다.', 403, 'INVALID_CREDENTIALS');
    }

    user.email = email;
    await user.save();
    return Response.json({ user: toSessionUser(user) });
  } catch (error) {
    return handleApiError(error, '이메일을 저장하지 못했습니다.');
  }
}
