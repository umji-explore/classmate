// 브라우저 전용 API 호출 헬퍼 (로그인 상태는 httpOnly 쿠키로 자동 전송됨)
import type { Preferences } from '@/lib/appearance';

export interface User {
  id: string;
  username: string;
  nickname: string;
  email: string | null; // 비밀번호 찾기 메일 주소 (예전 계정은 null)
  preferences: Preferences; // 꾸미기 설정
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

// 로그인이 만료되면 앱 전체에 알려서 시작 화면으로 돌아가게 한다
export const UNAUTHORIZED_EVENT = 'classmate:unauthorized';

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    // Blob(사진 등)은 그대로 보내고, 나머지는 JSON으로 보낸다
    const body = init?.body;
    const isBlob = body instanceof Blob;
    res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: body !== undefined ? { 'Content-Type': isBlob ? body.type : 'application/json' } : undefined,
      body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'UNAUTHORIZED') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(data?.error ?? `요청에 실패했습니다. (${res.status})`, res.status, data?.code);
  }
  return data as T;
}
