import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { normalizePreferences } from '@/lib/appearance';
import CalendarImage from '@/models/CalendarImage';
import User from '@/models/User';

// 브라우저에서 줄여서 올리므로 보통 수백 KB — 넉넉히 2MB까지 허용
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// GET /api/preferences/background - 내 달력 배경 사진
export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();
    await connectToDatabase();
    // lean()을 쓰면 data가 Buffer가 아닌 BSON Binary로 오므로 일반 문서로 읽는다
    const image = await CalendarImage.findOne({ user: sessionUser.id });
    if (!image) return jsonError('배경 사진이 없습니다.', 404);
    return new Response(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.content_type,
        // 주소에 ?v=<올린 시각>이 붙으므로, 새 사진을 올리면 주소가 바뀌어 다시 받는다
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return handleApiError(error, '배경 사진을 불러오지 못했습니다.');
  }
}

// PUT /api/preferences/background - 사진 올리기 (본문 = 이미지 파일 그대로)
export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const contentType = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!ALLOWED_TYPES.includes(contentType)) {
      return jsonError('JPG, PNG, WEBP 사진만 올릴 수 있습니다.', 400, 'VALIDATION');
    }
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) {
      return jsonError('사진 용량이 너무 큽니다. (최대 2MB)', 413, 'TOO_LARGE');
    }
    const data = Buffer.from(await request.arrayBuffer());
    if (data.length === 0) return jsonError('사진 파일이 비어 있습니다.', 400, 'VALIDATION');
    if (data.length > MAX_BYTES) return jsonError('사진 용량이 너무 큽니다. (최대 2MB)', 413, 'TOO_LARGE');

    await connectToDatabase();
    await CalendarImage.findOneAndUpdate(
      { user: sessionUser.id },
      { data, content_type: contentType },
      { upsert: true }
    );
    const user = await User.findByIdAndUpdate(
      sessionUser.id,
      { $set: { 'preferences.calendar_bg': 'image', 'preferences.calendar_bg_image_version': Date.now() } },
      { returnDocument: 'after' }
    )
      .select('preferences')
      .lean();
    if (!user) return unauthorized();
    return Response.json({ preferences: normalizePreferences(user.preferences) });
  } catch (error) {
    return handleApiError(error, '배경 사진을 저장하지 못했습니다.');
  }
}

// DELETE /api/preferences/background - 사진 지우기 (사진 배경을 쓰던 중이면 기본 배경으로)
export async function DELETE() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();
    await connectToDatabase();
    await CalendarImage.deleteOne({ user: sessionUser.id });

    const update: Record<string, unknown> = { 'preferences.calendar_bg_image_version': null };
    if (sessionUser.preferences.calendar_bg === 'image') update['preferences.calendar_bg'] = 'none';
    const user = await User.findByIdAndUpdate(sessionUser.id, { $set: update }, { returnDocument: 'after' })
      .select('preferences')
      .lean();
    if (!user) return unauthorized();
    return Response.json({ preferences: normalizePreferences(user.preferences) });
  } catch (error) {
    return handleApiError(error, '배경 사진을 지우지 못했습니다.');
  }
}
