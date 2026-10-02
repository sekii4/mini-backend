import { deleteTask, findTask, updateTask } from '../../lib/tasks.js';

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function notFound() {
  return Response.json({ error: 'Task not found' }, { status: 404 });
}

export async function GET(_request, { params }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return notFound();

  const task = findTask(id);
  return task ? Response.json(task) : notFound();
}

export async function PUT(request, { params }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return notFound();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body?.title !== 'string' || !body.title.trim() || typeof body.done !== 'boolean') {
    return Response.json({ error: 'Title and done are required' }, { status: 400 });
  }

  const task = updateTask(id, body.title.trim(), body.done);
  return task ? Response.json(task) : notFound();
}

export async function DELETE(_request, { params }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null || !deleteTask(id)) return notFound();

  return new Response(null, { status: 204 });
}