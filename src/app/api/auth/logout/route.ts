import { destroySession } from '@/lib/auth';
import { handleApiError } from '@/lib/api';

// POST /api/auth/logout - 세션 삭제 + 쿠키 제거
export async function POST() {
  try {
    await destroySession();
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '로그아웃에 실패했습니다.');
  }
}
