import { connectToDatabase } from '@/lib/mongodb';
import { getSessionUser, isDuplicateKeyError } from '@/lib/auth';
import { handleApiError, jsonError, unauthorized } from '@/lib/api';
import {
  CLASS_CODE_RULE, JOIN_LOCK_MINUTES, JOIN_MAX_FAILS, MAX_JOINED_CLASSES, MAX_MEMBERS, normalizeClassCode, summarizeClass,
} from '@/lib/classroom';
import Classroom from '@/models/Classroom';
import ClassMember from '@/models/ClassMember';
import User from '@/models/User';

// POST /api/classes/join - 참여 코드로 클래스 들어가기
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const code = normalizeClassCode(String(body?.code ?? ''));
    if (!CLASS_CODE_RULE.test(code)) return jsonError('참여 코드는 영문과 숫자 6자리예요.', 400, 'VALIDATION');

    await connectToDatabase();
    const me = await User.findById(user.id).select('class_join_fails class_join_locked_until');
    if (!me) return unauthorized();

    const now = Date.now();
    if (me.class_join_locked_until && me.class_join_locked_until.getTime() > now) {
      const minutes = Math.ceil((me.class_join_locked_until.getTime() - now) / 60000);
      return jsonError(`틀린 코드를 여러 번 입력해서 잠시 막혔어요. ${minutes}분 후에 다시 시도해 주세요.`, 429, 'LOCKED');
    }

    const classroom = await Classroom.findOne({ code });
    if (!classroom) {
      // 남의 클래스 코드를 마구 넣어 보는 것을 막는다
      const fails = (me.class_join_fails ?? 0) + 1;
      await User.updateOne(
        { _id: me._id },
        fails >= JOIN_MAX_FAILS
          ? { $set: { class_join_fails: 0, class_join_locked_until: new Date(now + JOIN_LOCK_MINUTES * 60000) } }
          : { $set: { class_join_fails: fails } }
      );
      return jsonError('해당 코드의 클래스를 찾을 수 없어요. 코드를 다시 확인해 주세요.', 404, 'NOT_FOUND');
    }
    if (me.class_join_fails) await User.updateOne({ _id: me._id }, { $set: { class_join_fails: 0 } });

    const existing = await ClassMember.findOne({ classroom: classroom._id, user: user.id });
    if (existing) {
      return Response.json({ class: await summarizeClass(classroom, existing, user.id), already: true });
    }

    if ((await ClassMember.countDocuments({ user: user.id })) >= MAX_JOINED_CLASSES) {
      return jsonError(`클래스는 ${MAX_JOINED_CLASSES}개까지 참여할 수 있어요.`, 400, 'LIMIT');
    }
    if ((await ClassMember.countDocuments({ classroom: classroom._id })) >= MAX_MEMBERS) {
      return jsonError('이 클래스는 인원이 가득 찼어요. 클래스장에게 문의해 주세요.', 400, 'FULL');
    }

    try {
      // 들어오기 전에 올라온 공지도 '새 공지'로 보이도록 읽은 시각은 비워 둔다(가장 오래된 시각)
      const member = await ClassMember.create({ classroom: classroom._id, user: user.id, role: 'member', last_read_at: new Date(0) });
      return Response.json({ class: await summarizeClass(classroom, member, user.id), already: false }, { status: 201 });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // 같은 순간에 두 번 눌린 경우
        const member = await ClassMember.findOne({ classroom: classroom._id, user: user.id });
        if (member) return Response.json({ class: await summarizeClass(classroom, member, user.id), already: true });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error, '클래스에 참여하지 못했습니다.');
  }
}
