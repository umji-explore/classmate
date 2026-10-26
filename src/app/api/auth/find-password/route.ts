import { connectToDatabase } from '@/lib/mongodb';
import { generateTempPassword, hashPassword, normalizeEmail, validateEmail } from '@/lib/auth';
import { isMailerConfigured, sendPasswordEmail } from '@/lib/mailer';
import { handleApiError, jsonError } from '@/lib/api';
import User from '@/models/User';

const MAX_FAILS = 5; // 연속으로 이만큼 틀리면
const LOCK_MINUTES = 15; // 이 시간 동안 비밀번호 찾기를 막는다
const RESEND_SECONDS = 60; // 같은 계정으로 메일을 다시 보내려면 기다려야 하는 시간
const TEMP_VALID_MINUTES = 30; // 임시 비밀번호 유효 시간

// POST /api/auth/find-password - 아이디 + 가입 이메일이 맞으면 임시 비밀번호를 이메일로 보낸다
// 원래 비밀번호는 그대로 두고, 임시 비밀번호는 30분 동안만 추가로 쓸 수 있다.
// (다른 사람이 장난으로 요청해도 내 원래 비밀번호로는 계속 로그인할 수 있게)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim().toLowerCase();
    const email = normalizeEmail(String(body?.email ?? ''));

    if (!username || validateEmail(email)) {
      return jsonError('아이디와 가입할 때 입력한 이메일을 정확히 입력해 주세요.', 400, 'VALIDATION');
    }
    if (!isMailerConfigured()) {
      console.error('GMAIL_USER / GMAIL_APP_PASSWORD 환경 변수가 설정되지 않았습니다.');
      return jsonError('지금은 비밀번호 찾기 메일을 보낼 수 없어요. 관리자에게 문의해 주세요.', 503, 'MAILER_NOT_CONFIGURED');
    }

    await connectToDatabase();
    const user = await User.findOne({ username });
    const mismatch = () => jsonError('아이디 또는 이메일이 올바르지 않습니다.', 401, 'INVALID_RECOVERY');
    if (!user) return mismatch();

    const now = Date.now();
    if (user.reset_locked_until && user.reset_locked_until.getTime() > now) {
      const minutes = Math.ceil((user.reset_locked_until.getTime() - now) / 60000);
      return jsonError(`여러 번 틀려서 잠시 막혔어요. ${minutes}분 후에 다시 시도해 주세요.`, 429, 'LOCKED');
    }

    if (!user.email) {
      return jsonError(
        '이 계정은 이메일이 등록되어 있지 않아 비밀번호를 찾을 수 없어요. 로그인한 뒤 설정에서 이메일을 등록해 주세요.',
        404,
        'NO_EMAIL'
      );
    }

    if (user.email !== email) {
      const fails = (user.reset_failed_count ?? 0) + 1;
      await User.updateOne(
        { _id: user._id },
        fails >= MAX_FAILS
          ? { $set: { reset_failed_count: 0, reset_locked_until: new Date(now + LOCK_MINUTES * 60000) } }
          : { $set: { reset_failed_count: fails } }
      );
      return mismatch();
    }

    if (user.reset_email_sent_at && now - user.reset_email_sent_at.getTime() < RESEND_SECONDS * 1000) {
      const wait = Math.ceil((RESEND_SECONDS * 1000 - (now - user.reset_email_sent_at.getTime())) / 1000);
      return jsonError(`방금 메일을 보냈어요. ${wait}초 후에 다시 요청할 수 있어요.`, 429, 'TOO_SOON');
    }

    // 메일을 먼저 보내고, 보내기에 성공했을 때만 임시 비밀번호를 저장한다
    const tempPassword = generateTempPassword();
    await sendPasswordEmail(user.email, user.nickname, user.username, tempPassword);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          temp_password_hash: await hashPassword(tempPassword),
          temp_password_expires_at: new Date(now + TEMP_VALID_MINUTES * 60000),
          reset_email_sent_at: new Date(now),
          reset_failed_count: 0,
          reset_locked_until: null,
        },
      }
    );

    return Response.json({ success: true, email: maskEmail(user.email) });
  } catch (error) {
    return handleApiError(error, '비밀번호 찾기 메일을 보내지 못했습니다.');
  }
}

// 화면에 보여줄 때 일부만 표시: minji1234@gmail.com → mi*******@gmail.com
function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
