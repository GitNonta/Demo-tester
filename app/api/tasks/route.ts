import { NextResponse } from "next/server";
import { addTask, listTasks, removeTask, updateStatus, Status } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const STATUSES: Status[] = ["todo", "doing", "done"];

export async function GET() {
  return NextResponse.json(listTasks());
}

export async function POST(req: Request) {
  const { title } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "ต้องระบุชื่องาน" }, { status: 400 });
  }
  return NextResponse.json(addTask(title.trim()), { status: 201 });
}

export async function PATCH(req: Request) {
  const { id, status } = (await req.json()) as { id: number; status: Status };
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }
  const updated = updateStatus(id, status);
  if (!updated) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  removeTask(id);
  return NextResponse.json({ ok: true });
}
