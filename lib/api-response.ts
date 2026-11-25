import { NextResponse } from "next/server";
import { ValidationError } from "./task-model";

/** แปลง id จาก path เป็นตัวเลขบวก หรือคืน null ถ้าไม่ถูกต้อง */
export function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw.trim()) return null;
  return id;
}

/** อ่าน JSON body และกันเนื้อหาที่ไม่ใช่ object */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw new ValidationError("body", "body ต้องเป็น JSON ที่ถูกต้อง");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ValidationError("body", "body ต้องเป็น JSON object");
  }
  return payload as Record<string, unknown>;
}

/** แปลงข้อผิดพลาดเป็น response ที่เหมาะสม */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, field: error.field },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** response สำหรับกรณีไม่พบข้อมูล */
export function notFoundResponse(id: number): NextResponse {
  return NextResponse.json({ error: `ไม่พบงานหมายเลข ${id}` }, { status: 404 });
}
