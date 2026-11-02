import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { NeisError } from '@/lib/neis';
import { pushConfigured, sendToUser } from '@/lib/push';
import { eveningMessages } from '@/lib/school-notify';

// POST /api/push/test - 내 기기로 알림 미리 보내 보기 (학생은 실제 '내일 안내' 알림, 개인용은 확인 알림)
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (!pushConfigured()) return jsonError('서버에 알림 키가 아직 설정되지 않았어요.', 503, 'PUSH_NOT_CONFIGURED');

    const messages = user.school ? await eveningMessages(user.school) : [];
    if (!messages.length) {
      messages.push({ title: 'ClassMate 알림 테스트 ✅', body: '이 기기에서 알림을 잘 받고 있어요.', url: '/' });
    }
    let sent = 0;
    for (const message of messages) sent += await sendToUser(user.id, message);
    if (!sent) return jsonError('알림을 받을 기기가 없어요. 이 기기에서 알림을 먼저 켜 주세요.', 400, 'NO_DEVICE');
    return Response.json({ sent });
  } catch (error) {
    if (error instanceof NeisError) return jsonError(error.message, 502, 'NEIS');
    return handleApiError(error, '테스트 알림을 보내지 못했습니다.');
  }
}
