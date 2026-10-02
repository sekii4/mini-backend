import { createTask, listTasks } from '../lib/tasks.js';

export async function GET() {
  return Response.json(listTasks());
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body?.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  return Response.json(createTask(body.title.trim()), { status: 201 });
}