import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { isCalendarBg, isHexColor, isModeId, isThemeId, normalizePreferences } from '@/lib/appearance';
import User from '@/models/User';

// PUT /api/preferences - 꾸미기 설정 저장 (보낸 항목만 바꿈)
export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (body?.theme !== undefined) {
      if (!isThemeId(body.theme)) return jsonError('알 수 없는 색 테마입니다.', 400, 'VALIDATION');
      update['preferences.theme'] = body.theme;
    }
    if (body?.mode !== undefined) {
      if (!isModeId(body.mode)) return jsonError('알 수 없는 화면 모드입니다.', 400, 'VALIDATION');
      update['preferences.mode'] = body.mode;
    }
    if (body?.calendar_bg !== undefined) {
      if (!isCalendarBg(body.calendar_bg)) return jsonError('알 수 없는 달력 배경입니다.', 400, 'VALIDATION');
      // 사진 배경은 사진이 올라가 있을 때만 고를 수 있다
      if (body.calendar_bg === 'image' && sessionUser.preferences.calendar_bg_image_version === null) {
        return jsonError('먼저 배경 사진을 올려 주세요.', 400, 'VALIDATION');
      }
      update['preferences.calendar_bg'] = body.calendar_bg;
    }
    if (body?.calendar_bg_color !== undefined) {
      if (!isHexColor(body.calendar_bg_color)) return jsonError('색상 값이 올바르지 않습니다.', 400, 'VALIDATION');
      update['preferences.calendar_bg_color'] = body.calendar_bg_color.toLowerCase();
    }

    if (Object.keys(update).length === 0) return Response.json({ preferences: sessionUser.preferences });

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(sessionUser.id, { $set: update }, { returnDocument: 'after' })
      .select('preferences')
      .lean();
    if (!user) return unauthorized();
    return Response.json({ preferences: normalizePreferences(user.preferences) });
  } catch (error) {
    return handleApiError(error, '꾸미기 설정을 저장하지 못했습니다.');
  }
}
