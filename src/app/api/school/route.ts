import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser, toSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { NeisError } from '@/lib/neis';
import { verifySchoolInput } from '@/lib/school-server';
import User from '@/models/User';

// PUT /api/school - 계정 유형(개인용/학생용)과 학교·학년·반 변경
export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const body = await request.json();
    let update: Record<string, unknown>;
    if (body?.account_type === 'personal') {
      // 개인용으로 바꿔도 학교 정보는 남겨 두어, 다시 학생용으로 바꿀 때 그대로 쓸 수 있게 한다
      update = { account_type: 'personal' };
    } else if (body?.account_type === 'student') {
      const verified = await verifySchoolInput(body?.school);
      if (typeof verified === 'string') return jsonError(verified, 400, 'VALIDATION');
      update = { account_type: 'student', school: verified };
    } else {
      return jsonError('계정 유형을 선택해 주세요.', 400, 'VALIDATION');
    }

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(sessionUser.id, { $set: update }, { returnDocument: 'after', runValidators: true });
    if (!user) return unauthorized();
    return Response.json({ user: toSessionUser(user) });
  } catch (error) {
    if (error instanceof NeisError) return jsonError(error.message, 502, 'NEIS');
    return handleApiError(error, '학교 정보를 저장하지 못했습니다.');
  }
}
