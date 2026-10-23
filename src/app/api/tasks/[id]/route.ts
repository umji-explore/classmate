import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { getOwner, handleApiError, jsonError, unauthorized, pickTaskFields } from '@/lib/api';
import Task from '@/models/Task';
import { NextRequest } from 'next/server';

const notFound = () => jsonError('과제를 찾을 수 없습니다.', 404);

// PUT /api/tasks/[id] - 과제 수정
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  try {
    const owner = await getOwner();
    if (!owner) return unauthorized();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound();

    await connectToDatabase();
    const update = pickTaskFields(await request.json());
    if (update.status && update.status !== 'done') update.completed_at = null;

    const updated = await Task.findOneAndUpdate({ _id: id, owner }, update, {
      returnDocument: 'after',
      runValidators: true,
    })
      .select('-owner -__v')
      .lean();

    if (!updated) return notFound();
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error, '과제를 수정하는 데 실패했습니다.');
  }
}

// DELETE /api/tasks/[id] - 과제 삭제
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  try {
    const owner = await getOwner();
    if (!owner) return unauthorized();
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return notFound();

    await connectToDatabase();
    const deleted = await Task.findOneAndDelete({ _id: id, owner }).lean();
    if (!deleted) return notFound();

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, '과제를 삭제하는 데 실패했습니다.');
  }
}
