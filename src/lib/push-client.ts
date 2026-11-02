// 브라우저에서 푸시 알림 켜기·끄기
import { api, ApiError } from '@/lib/client';

export type PushSupport = 'supported' | 'unsupported' | 'ios-install';

export function pushSupport(): PushSupport {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  // 아이폰·아이패드는 사파리에서 '홈 화면에 추가'한 앱에서만 푸시 알림을 받을 수 있다
  if (isIOS && !standalone) return 'ios-install';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported';
}

const registerWorker = () => navigator.serviceWorker.register('/sw.js');

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function base64UrlToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function enablePush(): Promise<void> {
  const { publicKey } = await api<{ publicKey: string | null }>('/api/push');
  if (!publicKey) throw new ApiError('서버에 알림 키가 아직 설정되지 않았어요.', 503);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new ApiError('알림 권한이 거부되었어요. 브라우저(또는 휴대폰) 설정에서 ClassMate 알림을 허용해 주세요.', 403);
  }
  const registration = await registerWorker();
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  await api('/api/push', { method: 'POST', body: subscription.toJSON() });
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api('/api/push', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => {});
  await subscription.unsubscribe();
}
