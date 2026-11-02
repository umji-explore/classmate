import { NextRequest } from 'next/server';
import { jsonError } from '@/lib/api';
import { NeisError, searchSchools } from '@/lib/neis';

// GET /api/school/search?q=학교이름 - 회원가입 화면에서도 쓰므로 로그인 없이 사용
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 30) return jsonError('학교 이름을 2글자 이상 입력해 주세요.', 400, 'VALIDATION');
  try {
    return Response.json({ schools: await searchSchools(q) });
  } catch (error) {
    if (error instanceof NeisError) return jsonError(error.message, 502, 'NEIS');
    console.error('학교 검색 실패', error);
    return jsonError('학교를 검색하지 못했습니다.', 500);
  }
}
