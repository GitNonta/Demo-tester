import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { formatDays, summarize } from "@/lib/task-metrics";
import { taskRepository } from "@/lib/task-repository";

export const dynamic = "force-dynamic";

/**
 * สรุปตัวเลขของงานทั้งหมดที่ยังไม่ถูกลบ
 * ใช้โดยหน้า /insights
 */
export async function GET() {
  try {
    const tasks = taskRepository.all();
    const metrics = summarize(tasks);
    return NextResponse.json({
      metrics,
      labels: {
        oldestOpenAge: metrics.oldestOpen
          ? formatDays(metrics.oldestOpen.ageDays)
          : null,
      },
      historySize: taskRepository.history().length,
      undoAvailable: taskRepository.undoCount(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
