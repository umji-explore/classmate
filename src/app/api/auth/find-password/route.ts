import { timingSafeEqual } from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { decryptPassword, isPasswordVaultEnabled, normalizeRecoveryCode, RECOVERY_CODE_RULE } from '@/lib/auth';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

const MAX_FAILS = 5; // 연속으로 이만큼 틀리면
const LOCK_MINUTES = 15; // 이 시간 동안 비밀번호 찾기를 막는다

const sameCode = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// POST /api/auth/find-password - 아이디 + 고유 코드로 본인 확인 후 원래 비밀번호를 알려준다
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const code = normalizeRecoveryCode(String(body?.recovery_code ?? ''));

    if (!username || !RECOVERY_CODE_RULE.test(code)) {
      return jsonError('아이디와 6자리 고유 코드를 정확히 입력해 주세요.', 400, 'VALIDATION');
    }

    // 암호화 열쇠가 없으면 비밀번호를 복호화할 수 없으므로 아무것도 바꾸지 않고 중단
    if (!isPasswordVaultEnabled()) {
      console.error('PASSWORD_ENCRYPTION_KEY 환경 변수가 없거나 올바르지 않습니다.');
      return jsonError('지금은 비밀번호 찾기를 사용할 수 없어요. 관리자에게 문의해 주세요.', 503, 'VAULT_NOT_CONFIGURED');
    }

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

    if (user.reset_failed_count || user.reset_locked_until) {
      await User.updateOne({ _id: user._id }, { $set: { reset_failed_count: 0, reset_locked_until: null } });
    }

    // 가입(또는 로그인·비밀번호 변경) 때 입력한 원래 비밀번호를 복호화해서 그대로 알려준다
    const password = decryptPassword(user.password_enc);
    if (password) return Response.json({ password });

    // 이 기능이 생기기 전에 가입한 뒤 한 번도 로그인하지 않은 계정은 원래 비밀번호가 저장되어 있지 않다
    // (임시 비밀번호로 바꾸지 않고 그대로 둔다)
    return jsonError(
      '이 계정은 비밀번호 찾기 기능이 생기기 전에 가입해서 비밀번호가 보관되어 있지 않아요. 기억나는 비밀번호로 한 번 로그인하면 그 다음부터 찾을 수 있어요.',
      404,
      'PASSWORD_NOT_STORED'
    );
  } catch (error) {
    return handleApiError(error, '비밀번호를 찾지 못했습니다.');
  }
}
