// 웹 푸시 알림 보내기 (서버 전용) — VAPID 키는 Vercel 환경 변수에 저장
import webpush from 'web-push';
import { connectToDatabase } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

export interface PushMessage {
  title: string;
  body: string;
  url?: string; // 알림을 누르면 열 주소
  tag?: string; // 같은 tag의 알림은 새 것으로 덮어씀
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:classmate@example.com', publicKey, privateKey);
  configured = true;
  return true;
}

export const pushConfigured = () => configure();

// 한 사용자의 모든 기기로 보내고, 보낸 기기 수를 돌려준다
export async function sendToUser(userId: string, message: PushMessage): Promise<number> {
  if (!configure()) return 0;
  await connectToDatabase();
  const subs = await PushSubscription.find({ user: userId }).lean();
  const payload = JSON.stringify(message);
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (error) {
        // 알림을 끄거나 앱을 지운 기기는 더 이상 받을 수 없으므로 정리
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: sub._id });
        else console.error('푸시 알림 전송 실패', status, error);
      }
    })
  );
  return sent;
}
