import { NextResponse } from "next/server";
import {
  errorResponse,
  notFoundResponse,
  parseId,
  readJsonBody,
} from "@/lib/api-response";
import { taskRepository } from "@/lib/task-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/** อ่านงานหนึ่งรายการ (รวมงานที่ถูกลบถ้า sendincludeDeleted=true) */
export async function GET(req: Request, ctx: RouteContext) {
  const id = parseId(ctx.params.id);
  if (id === null) {
    return NextResponse.json({ error: "id ไม่ถูกต้อง" }, { status: 400 });
  }
  const url = new URL(req.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const task = taskRepository.find(id, { includeDeleted });
  if (!task) return notFoundResponse(id);
  return NextResponse.json({
    task,
    history: taskRepository.history(id).slice(0, 20),
  });
}

/** แก้ไขฟิลด์ของงาน รองรับ title, status, priority, tags, assignee, dueDate */
export async function PATCH(req: Request, ctx: RouteContext) {
  const id = parseId(ctx.params.id);
  if (id === null) {
    return NextResponse.json({ error: "id ไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const body = await readJsonBody(req);
    const actor = typeof body.actor === "string" ? body.actor : "api";
    const updated = taskRepository.update(
      id,
      {
        title: body.title as string | undefined,
        status: body.status as never,
        priority: body.priority as never,
        tags: body.tags as string[] | undefined,
        assignee: body.assignee as string | null | undefined,
        dueDate: body.dueDate as string | null | undefined,
      },
      actor,
    );
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

/** ลบงานแบบ soft delete (ยังกู้คืนได้) */
export async function DELETE(req: Request, ctx: RouteContext) {
  const id = parseId(ctx.params.id);
  if (id === null) {
    return NextResponse.json({ error: "id ไม่ถูกต้อง" }, { status: 400 });
  }
  const url = new URL(req.url);
  const actor = url.searchParams.get("actor") ?? "api";
  try {
    const deleted = taskRepository.softDelete(id, actor);
    return NextResponse.json({ ok: true, task: deleted });
  } catch (error) {
    return errorResponse(error);
  }
}

/** กู้คืนงานที่ถูกลบไปแล้ว */
export async function POST(req: Request, ctx: RouteContext) {
  const id = parseId(ctx.params.id);
  if (id === null) {
    return NextResponse.json({ error: "id ไม่ถูกต้อง" }, { status: 400 });
  }
  const url = new URL(req.url);
  const actor = url.searchParams.get("actor") ?? "api";
  try {
    const restored = taskRepository.restore(id, actor);
    return NextResponse.json({ ok: true, task: restored });
  } catch (error) {
    return errorResponse(error);
  }
}
