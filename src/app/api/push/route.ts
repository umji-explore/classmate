import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { pushConfigured, vapidPublicKey } from '@/lib/push';
import PushSubscription from '@/models/PushSubscription';

// GET /api/push - 알림 구독에 필요한 공개 키 (서버에 키가 없으면 null)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return Response.json({ publicKey: pushConfigured() ? vapidPublicKey() : null });
}

// POST /api/push - 이 기기에서 알림 켜기 (브라우저가 만든 구독 정보를 저장)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const body = await request.json();
    const endpoint = String(body?.endpoint ?? '');
    const p256dh = String(body?.keys?.p256dh ?? '');
    const auth = String(body?.keys?.auth ?? '');
    if (!endpoint.startsWith('https://') || !p256dh || !auth) {
      return jsonError('알림 구독 정보가 올바르지 않습니다.', 400, 'VALIDATION');
    }
    await connectToDatabase();
    // 같은 기기를 다른 계정으로 다시 구독하면 마지막 계정으로 옮긴다
    await PushSubscription.updateOne(
      { endpoint },
      { $set: { user: user.id, keys: { p256dh, auth } } },
      { upsert: true, runValidators: true }
    );
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '알림을 켜지 못했습니다.');
  }
}

// DELETE /api/push - 이 기기에서 알림 끄기
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const body = await request.json().catch(() => null);
    await connectToDatabase();
    await PushSubscription.deleteOne({ user: user.id, endpoint: String(body?.endpoint ?? '') });
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '알림을 끄지 못했습니다.');
  }
}
