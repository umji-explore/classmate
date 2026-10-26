import { connectToDatabase } from '@/lib/mongodb';
import { createSession, ensureRecoveryCode, verifyDummyPassword, verifyPassword } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

// POST /api/auth/login - 아이디/비밀번호 확인 후 로그인 쿠키 발급
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    if (!username || !password) return jsonError('아이디와 비밀번호를 입력해 주세요.', 400, 'VALIDATION');

    await connectToDatabase();
    const user = await User.findOne({ username });

    // 아이디가 없을 때와 비밀번호가 틀렸을 때 같은 메시지를 보여줘 아이디 존재 여부를 숨김
    const ok = user ? await verifyPassword(password, user.password_hash) : await verifyDummyPassword(password);
    if (!user || !ok) return jsonError('아이디 또는 비밀번호가 올바르지 않습니다.', 401, 'INVALID_CREDENTIALS');

    await createSession(user._id);
    const id = String(user._id);
    const recovery_code = await ensureRecoveryCode(id, user.recovery_code);
    return Response.json({ user: { id, username: user.username, nickname: user.nickname, recovery_code } });
  } catch (error) {
    return handleApiError(error, '로그인에 실패했습니다.');
  }
}
