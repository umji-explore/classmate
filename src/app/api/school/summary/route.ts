import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { NeisError } from '@/lib/neis';
import { getSchoolSummary } from '@/lib/school-server';

// GET /api/school/summary - 오늘·내일 시간표와 준비물, 다가오는 시험·체험학습, 다음 방학
export async function GET() {
  // 로그인 확인은 try 밖에서 (빌드 시 미리 렌더링을 멈추는 신호를 오류로 잡아 기록하지 않도록)
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    if (!user.school) return jsonError('학생용 계정에서만 쓸 수 있어요.', 400, 'NOT_STUDENT');
    return Response.json(await getSchoolSummary(user.school));
  } catch (error) {
    if (error instanceof NeisError) return jsonError(error.message, 502, 'NEIS');
    return handleApiError(error, '학교 정보를 불러오지 못했습니다.');
  }
}
