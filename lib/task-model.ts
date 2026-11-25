import type { Status } from "@/lib/tasks";

/** ระดับความสำคัญของงาน ใช้จัดลำดับในหน้ารวมและตัวกรอง */
export type Priority = "low" | "normal" | "high" | "urgent";

/** สถานะที่ระบบรองรับ เรียงตามลำดับการไหลของงาน */
export const STATUSES: readonly Status[] = ["todo", "doing", "done"];

/** ระดับความสำคัญทั้งหมด เรียงจากน้อยไปมาก */
export const PRIORITIES: readonly Priority[] = ["low", "normal", "high", "urgent"];

/** น้ำหนักของ priority ใช้เปรียบเทียบตอน sort */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

/** น้ำหนักของ status ใช้เปรียบเทียบตอน sort และตอนจัดกลุ่ม */
export const STATUS_WEIGHT: Record<Status, number> = {
  todo: 0,
  doing: 1,
  done: 2,
};

/** ป้ายกำกับภาษาไทยของแต่ละสถานะ ใช้แสดงผลบนหน้าเว็บ */
export const STATUS_LABEL: Record<Status, string> = {
  todo: "รอทำ",
  doing: "กำลังทำ",
  done: "เสร็จแล้ว",
};

/** ป้ายกำกับภาษาไทยของแต่ละระดับความสำคัญ */
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "ต่ำ",
  normal: "ปกติ",
  high: "สูง",
  urgent: "ด่วนมาก",
};

/** จำนวน tag สูงสุดต่อหนึ่งงาน */
export const MAX_TAGS = 8;

/** ความยาวสูงสุดของชื่องาน */
export const MAX_TITLE_LENGTH = 160;

/** ความยาวสูงสุดของชื่อ tag */
export const MAX_TAG_LENGTH = 24;

/** รูปแบบวันที่ที่รับ (YYYY-MM-DD) */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** รูปแบบ tag ที่อนุญาต รองรับอักษรไทย ตัวเลข ขีดกลาง และขีดล่าง */
const TAG_PATTERN = /^[a-z0-9ก-๙_-]+$/;

/**
 * งานหนึ่งรายการพร้อมข้อมูลที่หน้า insights ต้องใช้
 * เก็บเวลาเป็น epoch milliseconds เพื่อให้คำนวณระยะเวลาได้ง่าย
 */
export interface TaskRecord {
  id: number;
  title: string;
  status: Status;
  priority: Priority;
  tags: string[];
  assignee: string | null;
  /** วันที่ครบกำหนดรูปแบบ YYYY-MM-DD หรือ null ถ้าไม่กำหนด */
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
  /** เวลาที่ถูกย้ายไปสถานะ done ครั้งล่าสุด */
  completedAt: number | null;
  /** เวลาที่ถูกลบแบบ soft delete */
  deletedAt: number | null;
}

/** ประเภทของเหตุการณ์ที่เก็บใน activity log */
export type TaskEventType =
  | "created"
  | "updated"
  | "status-changed"
  | "deleted"
  | "restored"
  | "undone";

/** เหตุการณ์หนึ่งรายการใน log ใช้คำนวณ throughput และประวัติงาน */
export interface TaskEvent {
  id: number;
  taskId: number;
  type: TaskEventType;
  at: number;
  actor: string;
  detail: string;
}

/** ข้อมูลที่รับเข้ามาตอนสร้างงาน */
export interface CreateTaskInput {
  title: string;
  status?: Status;
  priority?: Priority;
  tags?: string[];
  assignee?: string | null;
  dueDate?: string | null;
}

/** ข้อมูลที่รับเข้ามาตอนแก้ไขงาน (ทุกฟิลด์ไม่บังคับ) */
export type UpdateTaskInput = Partial<CreateTaskInput>;

/** ข้อผิดพลาดจากข้อมูลที่ไม่ผ่าน validation ใช้แปลงเป็น HTTP 400 */
export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/** ตรวจว่าเป็นสถานะที่ระบบรู้จักหรือไม่ */
export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** ตรวจว่าเป็น priority ที่ระบบรู้จักหรือไม่ */
export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

/** ตรวจว่าเป็น TaskRecord ที่มีฟิลด์ครบตามที่ต้องการหรือไม่ */
export function isTaskRecord(value: unknown): value is TaskRecord {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Partial<TaskRecord>;
  return (
    typeof task.id === "number" &&
    typeof task.title === "string" &&
    isStatus(task.status) &&
    isPriority(task.priority) &&
    Array.isArray(task.tags) &&
    typeof task.createdAt === "number" &&
    typeof task.updatedAt === "number"
  );
}

/** ตัดช่องว่างหัวท้ายและตรวจความยาวของชื่องาน */
export function normalizeTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("title", "ต้องระบุชื่องานเป็นข้อความ");
  }
  const title = value.trim();
  if (title.length === 0) {
    throw new ValidationError("title", "ต้องระบุชื่องาน");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(
      "title",
      `ชื่องานยาวเกิน ${MAX_TITLE_LENGTH} ตัวอักษร`,
    );
  }
  return title;
}

/**
 * ทำความสะอาดรายการ tag: ตัดช่องว่าง, ทำเป็นตัวพิมพ์เล็ก, กันค่าซ้ำ
 * และเรียงตามตัวอักษรเพื่อให้ผลลัพธ์คงที่
 */
export function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError("tags", "tags ต้องเป็นรายการข้อความ");
  }
  const unique = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") {
      throw new ValidationError("tags", "tag แต่ละตัวต้องเป็นข้อความ");
    }
    const tag = raw.trim().toLowerCase();
    if (tag.length === 0) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new ValidationError("tags", `tag ยาวเกิน ${MAX_TAG_LENGTH} ตัวอักษร`);
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new ValidationError("tags", `tag "${tag}" มีอักขระที่ไม่อนุญาต`);
    }
    unique.add(tag);
  }
  if (unique.size > MAX_TAGS) {
    throw new ValidationError("tags", `ใส่ tag ได้ไม่เกิน ${MAX_TAGS} ตัว`);
  }
  return [...unique].sort();
}

/** ตรวจชื่อผู้รับผิดชอบ: ว่างได้ แต่ถ้ามีต้องยาวไม่เกิน 40 ตัวอักษร */
export function normalizeAssignee(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError("assignee", "assignee ต้องเป็นข้อความ");
  }
  const assignee = value.trim();
  if (assignee.length === 0) return null;
  if (assignee.length > 40) {
    throw new ValidationError("assignee", "ชื่อผู้รับผิดชอบยาวเกิน 40 ตัวอักษร");
  }
  return assignee;
}

/**
 * ตรวจวันที่ครบกำหนดรูปแบบ YYYY-MM-DD และกันวันที่ที่ไม่มีจริง
 * เช่น 2026-02-31 จะถูกปฏิเสธเพราะ Date จะเลื่อนไปเป็นเดือนถัดไป
 */
export function normalizeDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError("dueDate", "dueDate ต้องเป็นข้อความรูปแบบ YYYY-MM-DD");
  }
  const text = value.trim();
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    throw new ValidationError("dueDate", "dueDate ต้องเป็นรูปแบบ YYYY-MM-DD");
  }
  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
  ) {
    throw new ValidationError("dueDate", "dueDate ไม่ใช่วันที่ที่มีอยู่จริง");
  }
  return text;
}

/** แปลงค่า status จากภายนอกเป็น Status หรือโยน ValidationError */
export function parseStatus(value: unknown): Status {
  if (!isStatus(value)) {
    throw new ValidationError("status", "สถานะไม่ถูกต้อง");
  }
  return value;
}

/** แปลงค่า priority จากภายนอกเป็น Priority หรือโยน ValidationError */
export function parsePriority(value: unknown): Priority {
  if (!isPriority(value)) {
    throw new ValidationError("priority", "ระดับความสำคัญไม่ถูกต้อง");
  }
  return value;
}

/** แปลงเวลา epoch milliseconds เป็นสตริงวันที่แบบ YYYY-MM-DD (เวลาไทย) */
export function isoDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10);
}

/** จำนวนวันเต็มระหว่างสองเวลา (ปัดลง) */
export function daysBetween(from: number, to: number): number {
  return Math.floor((to - from) / 86_400_000);
}

/** ค่าที่อยู่ตรงกลางของวัน (เที่ยงคืนตามเวลาเครื่อง) */
export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** วันสุดท้ายของสัปดาห์ปัจจุบัน (วันอาทิตย์ 23:59:59) */
export function endOfWeek(timestamp: number): number {
  const date = new Date(startOfDay(timestamp));
  const day = date.getDay();
  date.setDate(date.getDate() + (7 - day));
  return date.getTime() - 1;
}

/** ตรวจว่างานนี้เลยกำหนดหรือยัง โดยงานที่เสร็จแล้วถือว่าไม่เลยกำหนด */
export function isOverdue(task: TaskRecord, now: number): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return task.dueDate < isoDay(now);
}
