import { connectToDatabase } from '@/lib/mongodb';
import {
  createSession, generateUniqueRecoveryCode, hashPassword, isDuplicateKeyError, validateSignup,
} from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

const usernameTaken = () => jsonError('이미 사용 중인 아이디입니다.', 409, 'USERNAME_TAKEN');

// POST /api/auth/signup - 회원가입(고유 코드 발급) 후 바로 로그인
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const nickname = String(body?.nickname ?? '').trim();

    const invalid = validateSignup(username, password, nickname);
    if (invalid) return jsonError(invalid, 400, 'VALIDATION');

    await connectToDatabase();
    if (await User.exists({ username })) return usernameTaken();

    const password_hash = await hashPassword(password);

    // 고유 코드가 다른 계정과 겹치면(unique 인덱스 충돌) 새 코드로 다시 시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const recovery_code = await generateUniqueRecoveryCode();
      try {
        const user = await User.create({ username, nickname, password_hash, recovery_code });
        await createSession(user._id);
        return Response.json(
          { user: { id: String(user._id), username, nickname, recovery_code } },
          { status: 201 }
        );
      } catch (error) {
        if (!isDuplicateKeyError(error, 'recovery_code')) throw error;
      }
    }
    throw new Error('고유 코드 발급에 계속 실패했습니다.');
  } catch (error) {
    // 동시에 같은 아이디로 가입한 경우 (unique 인덱스 충돌)
    if (isDuplicateKeyError(error, 'username')) return usernameTaken();
    return handleApiError(error, '회원가입에 실패했습니다.');
  }
}
