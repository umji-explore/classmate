// 브라우저 전용 헬퍼: 기기별 익명 ID, API 호출, 데모 모드 저장소
import type { Task } from '@/types/task';

const CLIENT_ID_KEY = 'classmate_client_id';
const DEMO_TASKS_KEY = 'classmate_demo_tasks_v1';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let memoryClientId: string | null = null;

// 로그인 기능이 없으므로 기기(브라우저)마다 고유 ID를 만들어 내 과제만 불러온다.
export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    memoryClientId ??= randomId();
    return memoryClientId;
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: {
      'x-client-id': getClientId(),
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `요청에 실패했습니다. (${res.status})`, res.status, data?.code);
  }
  return data as T;
}

// ── 데모 모드(DB 미연결) 데이터는 이 브라우저에만 저장 ──
export function loadDemoTasks(): Task[] | null {
  try {
    const raw = localStorage.getItem(DEMO_TASKS_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : null;
  } catch {
    return null;
  }
}

export function saveDemoTasks(tasks: Task[]) {
  try {
    localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // 저장 공간이 없거나 시크릿 모드 등 — 메모리에서만 유지
  }
}
