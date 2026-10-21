import { connectToDatabase } from '@/lib/mongodb';
import Task from '@/models/Task';
import { NextRequest } from 'next/server';

// GET /api/tasks - 모든 과제 조회
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const tasks = await Task.find(query).sort({ due_date: 1 }).lean();
    return Response.json(tasks);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return Response.json({ error: '과제 목록을 불러오는 데 실패했습니다.' }, { status: 500 });
  }
}

// POST /api/tasks - 새 과제 생성
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();

    const task = new Task({
      title: body.title,
      subject: body.subject,
      kind: body.kind,
      due_date: body.due_date,
      estimated_minutes: body.estimated_minutes ?? 30,
      status: body.status ?? 'todo',
      priority: body.priority ?? 'normal',
      notes: body.notes ?? '',
      completed_at: body.status === 'done' ? body.completed_at ?? null : null,
    });

    await task.save();
    return Response.json(task, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return Response.json({ error: '과제를 저장하는 데 실패했습니다.' }, { status: 500 });
  }
}
