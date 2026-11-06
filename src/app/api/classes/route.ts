import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import { MAX_OWNED_CLASSES, summarizeClass, withUniqueClassCode } from '@/lib/classroom';
import { CLASS_DESC_MAX, CLASS_NAME_MAX } from '@/lib/classes';
import Classroom from '@/models/Classroom';
import ClassMember from '@/models/ClassMember';

// GET /api/classes - 내가 만든 클래스 + 참여한 클래스 목록 (최근 공지 순)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    await connectToDatabase();

    const memberships = await ClassMember.find({ user: user.id }).lean();
    const classrooms = await Classroom.find({ _id: { $in: memberships.map((m) => m.classroom) } }).lean();
    const byId = new Map(classrooms.map((c) => [String(c._id), c]));

    const classes = await Promise.all(
      memberships
        .filter((m) => byId.has(String(m.classroom)))
        .map((m) => summarizeClass(byId.get(String(m.classroom))!, m, user.id))
    );
    // 새 공지가 있는 클래스 → 최근 공지 → 이름 순
    classes.sort(
      (a, b) =>
        Number(b.unread > 0) - Number(a.unread > 0) ||
        (b.latest?.created_at ?? '').localeCompare(a.latest?.created_at ?? '') ||
        a.name.localeCompare(b.name)
    );
    return Response.json({ classes });
  } catch (error) {
    return handleApiError(error, '클래스 목록을 불러오지 못했습니다.');
  }
}

// POST /api/classes - 클래스 만들기 (만든 사람이 클래스장, 겹치지 않는 참여 코드 자동 발급)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const name = String(body?.name ?? '').trim();
    const description = String(body?.description ?? '').trim();
    if (!name || name.length > CLASS_NAME_MAX) return jsonError(`클래스 이름은 1~${CLASS_NAME_MAX}자로 입력해 주세요.`, 400, 'VALIDATION');
    if (description.length > CLASS_DESC_MAX) return jsonError(`소개는 ${CLASS_DESC_MAX}자까지 쓸 수 있어요.`, 400, 'VALIDATION');

    await connectToDatabase();
    if ((await Classroom.countDocuments({ owner: user.id })) >= MAX_OWNED_CLASSES) {
      return jsonError(`클래스는 ${MAX_OWNED_CLASSES}개까지 만들 수 있어요.`, 400, 'LIMIT');
    }

    const classroom = await withUniqueClassCode((code) => Classroom.create({ name, description, code, owner: user.id }));
    try {
      const member = await ClassMember.create({ classroom: classroom._id, user: user.id, role: 'owner' });
      return Response.json({ class: await summarizeClass(classroom, member, user.id) }, { status: 201 });
    } catch (error) {
      await Classroom.deleteOne({ _id: classroom._id }); // 클래스장 등록이 실패하면 빈 클래스를 남기지 않음
      throw error;
    }
  } catch (error) {
    return handleApiError(error, '클래스를 만들지 못했습니다.');
  }
}
