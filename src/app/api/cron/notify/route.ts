import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { jsonError } from '@/lib/api';
import { toSessionUser } from '@/lib/auth';
import { pushConfigured, sendToUser } from '@/lib/push';
import { eveningMessages, morningMessages } from '@/lib/school-notify';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';

// GET /api/cron/notify?slot=evening|morning - Vercel Cron이 매일 호출 (vercel.json)
//   evening: 한국 시간 저녁 8시 — 내일 시간표·준비물 + 3일 뒤 중요 일정
//   morning: 한국 시간 아침 7시 — 오늘 시간표·준비물
export async function GET(request: NextRequest) {
  // Vercel Cron은 CRON_SECRET을 Authorization 헤더에 담아 보낸다 (다른 사람이 호출하지 못하게)
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError('권한이 없습니다.', 401);
  }
  const slot = request.nextUrl.searchParams.get('slot');
  if (slot !== 'evening' && slot !== 'morning') return jsonError('slot 값이 올바르지 않습니다.', 400);
  if (!pushConfigured()) return jsonError('VAPID 키가 설정되지 않았습니다.', 503);

  await connectToDatabase();
  // 알림을 켠 기기가 있는 학생만
  const userIds = await PushSubscription.distinct('user');
  const users = await User.find({ _id: { $in: userIds }, account_type: 'student' })
    .select('username nickname email account_type school')
    .lean();

  let sent = 0;
  const failed: string[] = [];
  for (const raw of users) {
    const user = toSessionUser(raw);
    if (!user.school) continue;
    try {
      const messages = slot === 'evening' ? await eveningMessages(user.school) : await morningMessages(user.school);
      for (const message of messages) sent += await sendToUser(user.id, message);
    } catch (error) {
      // 한 학생(학교)에서 실패해도 다른 학생에게는 계속 보낸다
      console.error('학교 알림 만들기 실패', user.school.school_name, error);
      failed.push(user.id);
    }
  }
  return Response.json({ slot, users: users.length, sent, failed: failed.length });
}
