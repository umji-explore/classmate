import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { NeisError } from '@/lib/neis';
import { addDays, getSchoolDays } from '@/lib/school-server';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/school/days?from=YYYY-MM-DD&to=YYYY-MM-DD - 학교 달력용 날짜별 행사·시간표 (최대 6주)
export async function GET(request: NextRequest) {
  // 로그인 확인은 try 밖에서 (빌드 시 미리 렌더링을 멈추는 신호를 오류로 잡아 기록하지 않도록)
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    if (!user.school) return jsonError('학생용 계정에서만 쓸 수 있어요.', 400, 'NOT_STUDENT');

    const from = request.nextUrl.searchParams.get('from') ?? '';
    const to = request.nextUrl.searchParams.get('to') ?? '';
    if (!DATE.test(from) || !DATE.test(to) || to < from || addDays(from, 42) < to) {
      return jsonError('날짜 범위가 올바르지 않습니다.', 400, 'VALIDATION');
    }
    return Response.json({ days: await getSchoolDays(user.school, from, to) });
  } catch (error) {
    if (error instanceof NeisError) return jsonError(error.message, 502, 'NEIS');
    return handleApiError(error, '학교 달력을 불러오지 못했습니다.');
  }
}
