import mongoose from 'mongoose';
import { MissingDatabaseUriError } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import type { ITask } from '@/models/Task';

// 로그인한 사용자의 ID (과제의 owner 값). 로그인하지 않았으면 null
export async function getOwner(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

// 요청 본문에서 수정 가능한 필드만 골라낸다 (_id, owner 등을 임의로 바꾸지 못하게)
const EDITABLE_FIELDS = [
  'title', 'subject', 'kind', 'due_date', 'estimated_minutes',
  'status', 'priority', 'notes', 'completed_at',
] as const;

export function pickTaskFields(body: unknown): Partial<ITask> {
  const result: Record<string, unknown> = {};
  if (body && typeof body === 'object') {
    for (const key of EDITABLE_FIELDS) {
      if (key in body) result[key] = (body as Record<string, unknown>)[key];
    }
  }
  return result as Partial<ITask>;
}

export function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code }, { status });
}

export const unauthorized = () => jsonError('로그인이 필요합니다.', 401, 'UNAUTHORIZED');

// 공통 에러 → HTTP 응답 변환
export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof MissingDatabaseUriError) {
    return jsonError(error.message, 503, 'DB_NOT_CONFIGURED');
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return jsonError('입력값이 올바르지 않습니다. 필수 항목과 형식을 확인해 주세요.', 400, 'VALIDATION');
  }
  if (error instanceof SyntaxError) {
    return jsonError('요청 형식(JSON)이 올바르지 않습니다.', 400, 'BAD_JSON');
  }
  console.error(fallbackMessage, error);
  const isConnectionError =
    error instanceof mongoose.Error.MongooseServerSelectionError ||
    (error instanceof Error && /ECONNREFUSED|ENOTFOUND|querySrv|authentication failed/i.test(error.message));
  if (isConnectionError) {
    return jsonError('데이터베이스에 연결할 수 없습니다. MONGODB_URI와 Atlas 네트워크 접근 설정을 확인해 주세요.', 503, 'DB_UNAVAILABLE');
  }
  return jsonError(fallbackMessage, 500);
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
