import { connectToDatabase } from '@/lib/mongodb';
import { createSession, hashPassword, isDuplicateKeyError, normalizeEmail, toSessionUser, validateSignup } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

const usernameTaken = () => jsonError('이미 사용 중인 아이디입니다.', 409, 'USERNAME_TAKEN');

// POST /api/auth/signup - 회원가입(아이디·비밀번호·이름·이메일) 후 바로 로그인
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const nickname = String(body?.nickname ?? '').trim();
    const email = normalizeEmail(String(body?.email ?? ''));

    const invalid = validateSignup(username, password, nickname, email);
    if (invalid) return jsonError(invalid, 400, 'VALIDATION');

    await connectToDatabase();
    if (await User.exists({ username })) return usernameTaken();

    const user = await User.create({ username, nickname, email, password_hash: await hashPassword(password) });
    await createSession(user._id);

    return Response.json({ user: toSessionUser(user) }, { status: 201 });
  } catch (error) {
    // 동시에 같은 아이디로 가입한 경우 (unique 인덱스 충돌)
    if (isDuplicateKeyError(error, 'username')) return usernameTaken();
    return handleApiError(error, '회원가입에 실패했습니다.');
  }
}
