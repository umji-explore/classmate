import { timingSafeEqual } from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { hashPassword, normalizeRecoveryCode, RECOVERY_CODE_RULE, validatePassword } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import Session from '@/models/Session';
import User from '@/models/User';

const MAX_FAILS = 5; // 연속으로 이만큼 틀리면
const LOCK_MINUTES = 15; // 이 시간 동안 비밀번호 찾기를 막는다

const sameCode = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// POST /api/auth/reset-password - 아이디 + 고유 코드로 본인 확인 후 새 비밀번호 설정
// (비밀번호는 암호화되어 저장되므로 기존 비밀번호를 알려줄 수는 없고, 새로 정하게 한다)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const code = normalizeRecoveryCode(String(body?.recovery_code ?? ''));
    const newPassword = String(body?.new_password ?? '');

    if (!username || !RECOVERY_CODE_RULE.test(code)) {
      return jsonError('아이디와 6자리 고유 코드를 정확히 입력해 주세요.', 400, 'VALIDATION');
    }
    const invalidPassword = validatePassword(newPassword);
    if (invalidPassword) return jsonError(invalidPassword, 400, 'VALIDATION');

    await connectToDatabase();
    const user = await User.findOne({ username });
    const mismatch = () =>
      jsonError('아이디 또는 고유 코드가 올바르지 않습니다.', 401, 'INVALID_RECOVERY');

    if (!user) return mismatch();

    if (user.reset_locked_until && user.reset_locked_until > new Date()) {
      const minutes = Math.ceil((user.reset_locked_until.getTime() - Date.now()) / 60000);
      return jsonError(`여러 번 틀려서 잠시 막혔어요. ${minutes}분 후에 다시 시도해 주세요.`, 429, 'LOCKED');
    }

    if (!user.recovery_code || !sameCode(code, user.recovery_code)) {
      const fails = (user.reset_failed_count ?? 0) + 1;
      await User.updateOne(
        { _id: user._id },
        fails >= MAX_FAILS
          ? { $set: { reset_failed_count: 0, reset_locked_until: new Date(Date.now() + LOCK_MINUTES * 60000) } }
          : { $set: { reset_failed_count: fails } }
      );
      return mismatch();
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { password_hash: await hashPassword(newPassword), reset_failed_count: 0, reset_locked_until: null } }
    );
    // 다른 기기에 남아 있는 로그인도 모두 끊는다
    await Session.deleteMany({ user: user._id });

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '비밀번호를 변경하지 못했습니다.');
  }
}
