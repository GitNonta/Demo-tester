import { NextResponse } from "next/server";
import { parseId } from "@/lib/api-response";
import { taskRepository } from "@/lib/task-repository";

export const dynamic = "force-dynamic";

/**
 * ประวัติการเปลี่ยนแปลงล่าสุด
 * ตัวอย่าง: /api/history?limit=20&taskId=3
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 20;

  const rawTaskId = searchParams.get("taskId");
  if (rawTaskId === null) {
    return NextResponse.json({
      events: taskRepository.history().slice(0, limit),
      total: taskRepository.history().length,
    });
  }

  const taskId = parseId(rawTaskId);
  if (taskId === null) {
    return NextResponse.json({ error: "taskId ไม่ถูกต้อง" }, { status: 400 });
  }
  const events = taskRepository.history(taskId);
  return NextResponse.json({ events: events.slice(0, limit), total: events.length });
}
