import { connectToDatabase } from '@/lib/mongodb';
import { createSession, toSessionUser, verifyDummyPassword, verifyPassword } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import Session from '@/models/Session';
import User from '@/models/User';

// POST /api/auth/login - 아이디/비밀번호 확인 후 로그인 쿠키 발급
// (비밀번호 찾기로 받은 임시 비밀번호도 유효 시간 안에는 사용 가능)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    if (!username || !password) return jsonError('아이디와 비밀번호를 입력해 주세요.', 400, 'VALIDATION');

    await connectToDatabase();
    const user = await User.findOne({ username });
    const invalid = () => jsonError('아이디 또는 비밀번호가 올바르지 않습니다.', 401, 'INVALID_CREDENTIALS');

    if (!user) {
      // 아이디가 없을 때와 비밀번호가 틀렸을 때 같은 메시지 + 비슷한 응답 시간
      await verifyDummyPassword(password);
      return invalid();
    }

    const tempValid = !!user.temp_password_expires_at && user.temp_password_expires_at > new Date();

    if (await verifyPassword(password, user.password_hash)) {
      // 원래 비밀번호로 로그인했다면 발급해 둔 임시 비밀번호는 필요 없으니 폐기
      if (user.temp_password_hash) {
        await User.updateOne({ _id: user._id }, { $set: { temp_password_hash: null, temp_password_expires_at: null } });
      }
    } else if (tempValid && (await verifyPassword(password, user.temp_password_hash))) {
      // 임시 비밀번호로 로그인하면 그것을 새 비밀번호로 확정하고, 다른 기기 로그인은 해제
      await User.updateOne(
        { _id: user._id },
        { $set: { password_hash: user.temp_password_hash, temp_password_hash: null, temp_password_expires_at: null } }
      );
      await Session.deleteMany({ user: user._id });
    } else {
      return invalid();
    }

    await createSession(user._id);
    return Response.json({ user: toSessionUser(user) });
  } catch (error) {
    return handleApiError(error, '로그인에 실패했습니다.');
  }
}
