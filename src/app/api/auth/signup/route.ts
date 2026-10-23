import { connectToDatabase } from '@/lib/mongodb';
import { createSession, hashPassword, validateSignup } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

// POST /api/auth/signup - 회원가입 후 바로 로그인
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const nickname = String(body?.nickname ?? '').trim();

    const invalid = validateSignup(username, password, nickname);
    if (invalid) return jsonError(invalid, 400, 'VALIDATION');

    await connectToDatabase();
    if (await User.exists({ username })) {
      return jsonError('이미 사용 중인 아이디입니다.', 409, 'USERNAME_TAKEN');
    }

    const user = await User.create({ username, nickname, password_hash: await hashPassword(password) });
    await createSession(user._id);

    return Response.json({ user: { id: String(user._id), username, nickname } }, { status: 201 });
  } catch (error) {
    // 동시에 같은 아이디로 가입한 경우 (unique 인덱스 충돌)
    if ((error as { code?: number })?.code === 11000) {
      return jsonError('이미 사용 중인 아이디입니다.', 409, 'USERNAME_TAKEN');
    }
    return handleApiError(error, '회원가입에 실패했습니다.');
  }
}
