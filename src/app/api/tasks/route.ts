import { connectToDatabase } from '@/lib/mongodb';
import { escapeRegex, getOwner, handleApiError, jsonError, unauthorized, pickTaskFields } from '@/lib/api';
import Task from '@/models/Task';
import { NextRequest } from 'next/server';

const MAX_BULK = 50;

// GET /api/tasks - 내 과제 조회
export async function GET(request: NextRequest) {
  try {
    const owner = await getOwner();
    if (!owner) return unauthorized();
    await connectToDatabase();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: Record<string, unknown> = { owner };
    if (status && status !== 'all') query.status = status;
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ title: pattern }, { subject: pattern }, { notes: pattern }];
    }

    const tasks = await Task.find(query).sort({ due_date: 1 }).select('-owner -__v').lean();
    return Response.json(tasks);
  } catch (error) {
    return handleApiError(error, '과제 목록을 불러오는 데 실패했습니다.');
  }
}

// POST /api/tasks - 새 과제 생성 (배열을 보내면 여러 개를 한 번에 생성)
export async function POST(request: NextRequest) {
  try {
    const owner = await getOwner();
    if (!owner) return unauthorized();
    await connectToDatabase();
    const body = await request.json();
    const items: unknown[] = Array.isArray(body) ? body : [body];
    if (items.length === 0 || items.length > MAX_BULK) {
      return jsonError(`한 번에 1~${MAX_BULK}개까지 등록할 수 있습니다.`, 400);
    }

    const docs = items.map((item) => {
      const fields = pickTaskFields(item);
      return {
        ...fields,
        owner,
        completed_at: fields.status === 'done' ? fields.completed_at ?? null : null,
      };
    });

    const created = await Task.insertMany(docs);
    // 응답에는 owner 등 내부 필드를 빼고 돌려준다
    const result = await Task.find({ _id: { $in: created.map((doc) => doc._id) } })
      .select('-owner -__v')
      .lean();
    return Response.json(Array.isArray(body) ? result : result[0], { status: 201 });
  } catch (error) {
    return handleApiError(error, '과제를 저장하는 데 실패했습니다.');
  }
}

// DELETE /api/tasks - 내 과제 전체 삭제
export async function DELETE() {
  try {
    const owner = await getOwner();
    if (!owner) return unauthorized();
    await connectToDatabase();
    const { deletedCount } = await Task.deleteMany({ owner });
    return Response.json({ success: true, deletedCount });
  } catch (error) {
    return handleApiError(error, '과제를 삭제하는 데 실패했습니다.');
  }
}
