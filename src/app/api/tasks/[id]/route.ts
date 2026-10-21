import { connectToDatabase } from '@/lib/mongodb';
import Task from '@/models/Task';
import { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/tasks/[id] - 과제 수정
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const body = await request.json();

    const updated = await Task.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return Response.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error('PUT /api/tasks/[id] error:', error);
    return Response.json({ error: '과제를 수정하는 데 실패했습니다.' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - 과제 삭제
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;

    const deleted = await Task.findByIdAndDelete(id).lean();

    if (!deleted) {
      return Response.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return Response.json({ error: '과제를 삭제하는 데 실패했습니다.' }, { status: 500 });
  }
}
