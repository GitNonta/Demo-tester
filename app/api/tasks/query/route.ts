import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { applyQuery, parseQuery } from "@/lib/task-query";
import { taskRepository } from "@/lib/task-repository";

export const dynamic = "force-dynamic";

/**
 * ค้นหางานด้วย query string
 * ตัวอย่าง: /api/tasks/query?q=test&status=todo&priority=high&sort=dueDate:asc&page=1
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { filter, sort, pagination } = parseQuery(searchParams);
    const result = applyQuery(
      taskRepository.all({ includeDeleted: filter.includeDeleted }),
      filter,
      sort,
      pagination,
    );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * ค้นหาแบบส่งเงื่อนไขมาทาง body เหมาะกับตัวกรองที่ซับซ้อน
 * (ทุกฟิลด์ไม่บังคับ ใช้ค่าเริ่มต้นถ้าไม่ส่งมา)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const params = new URLSearchParams();
    if (typeof body.q === "string") params.set("q", body.q);
    if (Array.isArray(body.status)) {
      for (const status of body.status) params.append("status", String(status));
    }
    if (Array.isArray(body.priority)) {
      for (const priority of body.priority) {
        params.append("priority", String(priority));
      }
    }
    if (typeof body.tag === "string") params.set("tag", body.tag);
    if (typeof body.assignee === "string") params.set("assignee", body.assignee);
    if (typeof body.due === "string") params.set("due", body.due);
    if (body.includeDeleted === true) params.set("includeDeleted", "true");
    if (typeof body.sort === "string") params.set("sort", body.sort);
    if (typeof body.page === "number") params.set("page", String(body.page));
    if (typeof body.pageSize === "number") {
      params.set("pageSize", String(body.pageSize));
    }

    const { filter, sort, pagination } = parseQuery(params);
    const result = applyQuery(
      taskRepository.all({ includeDeleted: filter.includeDeleted }),
      filter,
      sort,
      pagination,
    );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
