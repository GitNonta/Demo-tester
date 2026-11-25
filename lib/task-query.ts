import type { Status } from "@/lib/tasks";
import {
  PRIORITY_WEIGHT,
  STATUS_WEIGHT,
  type Priority,
  type TaskRecord,
  endOfWeek,
  isOverdue,
  isPriority,
  isStatus,
  isoDay,
} from "./task-model";

/** ฟิลด์ที่อนุญาตให้เรียงลำดับ */
export type SortField =
  | "updatedAt"
  | "createdAt"
  | "dueDate"
  | "priority"
  | "status"
  | "title";

/** ทิศทางการเรียง */
export type SortDirection = "asc" | "desc";

/** ช่วงเวลาครบกำหนดที่ใช้กรอง */
export type DueFilter = "any" | "overdue" | "today" | "week";

/** เงื่อนไขการค้นหางาน */
export interface TaskFilter {
  q: string;
  statuses: Status[];
  priorities: Priority[];
  tag: string | null;
  assignee: string | null;
  due: DueFilter;
  includeDeleted: boolean;
}

/** การเรียงลำดับ */
export interface SortSpec {
  field: SortField;
  direction: SortDirection;
}

/** การแบ่งหน้า */
export interface Pagination {
  page: number;
  pageSize: number;
}

/** ผลลัพธ์จากการค้นหา พร้อมข้อมูลสำหรับแสดงตัวเลขหน้า */
export interface QueryResult {
  items: TaskRecord[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** ชุดเงื่อนไขที่แปลงมาจาก query string แล้ว */
export interface ParsedQuery {
  filter: TaskFilter;
  sort: SortSpec;
  pagination: Pagination;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const SORT_FIELDS: readonly SortField[] = [
  "updatedAt",
  "createdAt",
  "dueDate",
  "priority",
  "status",
  "title",
];

const DUE_FILTERS: readonly DueFilter[] = ["any", "overdue", "today", "week"];

/** อ่านค่าตัวเลขจำนวนเต็มจาก query string พร้อมกำหนดขอบเขต */
function readInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** รวมค่าที่ส่งมาหลายครั้ง (status=todo&status=doing) ให้เป็นรายการเดียว */
function readList(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * แปลง URLSearchParams เป็นเงื่อนไขค้นหาที่ปลอดภัย
 * ค่าที่ไม่รู้จักจะถูกเพิกเฉยแทนการโยน error เพื่อให้หน้าเว็บยังทำงานได้
 */
export function parseQuery(params: URLSearchParams): ParsedQuery {
  const q = (params.get("q") ?? "").trim().slice(0, 120);

  const statuses = readList(params.getAll("status")).filter(isStatus);
  const priorities = readList(params.getAll("priority")).filter(isPriority);

  const rawTag = (params.get("tag") ?? "").trim().toLowerCase();
  const tag = rawTag.length > 0 ? rawTag.slice(0, 24) : null;

  const rawAssignee = (params.get("assignee") ?? "").trim();
  const assignee = rawAssignee.length > 0 ? rawAssignee.slice(0, 40) : null;

  const rawDue = (params.get("due") ?? "any") as DueFilter;
  const due = DUE_FILTERS.includes(rawDue) ? rawDue : "any";

  const includeDeleted = params.get("includeDeleted") === "true";

  const rawSort = (params.get("sort") ?? "updatedAt:desc").split(":");
  const field = SORT_FIELDS.includes(rawSort[0] as SortField)
    ? (rawSort[0] as SortField)
    : "updatedAt";
  const direction: SortDirection = rawSort[1] === "asc" ? "asc" : "desc";

  return {
    filter: { q, statuses, priorities, tag, assignee, due, includeDeleted },
    sort: { field, direction },
    pagination: {
      page: readInt(params.get("page"), 1, 1, 10_000),
      pageSize: readInt(params.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    },
  };
}

/** แยกคำค้นเป็น token เพื่อให้ค้นแบบหลายคำได้ */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** ตรวจว่าข้อความค้นปรากฏในชื่องาน, tag หรือผู้รับผิดชอบ */
export function matchesText(task: TaskRecord, query: string): boolean {
  if (query.length === 0) return true;
  const tokens = tokenize(query);
  const haystack = [
    task.title.toLowerCase(),
    task.tags.join(" "),
    (task.assignee ?? "").toLowerCase(),
    `#${task.id}`,
  ].join(" ");
  return tokens.every((token) => haystack.includes(token));
}

/** ตรวจว่าตรงกับตัวกรองช่วงครบกำหนดหรือไม่ */
function matchesDue(task: TaskRecord, due: DueFilter, now: number): boolean {
  if (due === "any") return true;
  if (!task.dueDate) return false;
  if (due === "overdue") return isOverdue(task, now);
  if (due === "today") return task.dueDate === isoDay(now);
  return task.dueDate <= isoDay(endOfWeek(now)) && task.status !== "done";
}

/** ตรวจว่างานนี้ผ่านทุกเงื่อนไขหรือไม่ */
export function matchesFilter(
  task: TaskRecord,
  filter: TaskFilter,
  now = Date.now(),
): boolean {
  if (!filter.includeDeleted && task.deletedAt !== null) return false;
  if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) {
    return false;
  }
  if (
    filter.priorities.length > 0 &&
    !filter.priorities.includes(task.priority)
  ) {
    return false;
  }
  if (filter.tag && !task.tags.includes(filter.tag)) return false;
  if (filter.assignee && task.assignee !== filter.assignee) return false;
  if (!matchesDue(task, filter.due, now)) return false;
  return matchesText(task, filter.q);
}

/** เปรียบเทียบสองงานตามฟิลด์ที่กำหนด (ไม่สนใจทิศทาง) */
function compareTasks(a: TaskRecord, b: TaskRecord, field: SortField): number {
  switch (field) {
    case "priority":
      return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    case "status":
      return STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status];
    case "title":
      return a.title.localeCompare(b.title, "th");
    case "dueDate": {
      // งานที่ไม่กำหนดวันครบกำหนดถือว่าน้อยที่สุด
      if (a.dueDate === null && b.dueDate === null) return b.id - a.id;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    case "createdAt":
      return b.createdAt - a.createdAt;
    case "updatedAt":
    default:
      return b.updatedAt - a.updatedAt;
  }
}

/** เรียงงานตาม SortSpec โดยไม่แก้ไขอาร์เรย์ต้นฉบับ */
export function sortTasks(tasks: TaskRecord[], spec: SortSpec): TaskRecord[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    const result = compareTasks(a, b, spec.field);
    return spec.direction === "asc" ? -result : result;
  });
  return sorted;
}

/** ตัดหน้าแบบ 1-based และคำนวณข้อมูลประกอบ */
export function paginate(tasks: TaskRecord[], pagination: Pagination): QueryResult {
  const { page, pageSize } = pagination;
  const total = tasks.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  return {
    items: tasks.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    pages,
    hasNext: safePage < pages,
    hasPrev: safePage > 1,
  };
}

/** กรอง + เรียง + แบ่งหน้า ในคำสั่งเดียว */
export function applyQuery(
  tasks: TaskRecord[],
  filter: TaskFilter,
  sort: SortSpec,
  pagination: Pagination,
  now = Date.now(),
): QueryResult {
  const filtered = tasks.filter((task) => matchesFilter(task, filter, now));
  return paginate(sortTasks(filtered, sort), pagination);
}

/** จัดกลุ่มงานตามสถานะ */
export function groupByStatus(tasks: TaskRecord[]): Record<Status, TaskRecord[]> {
  const groups: Record<Status, TaskRecord[]> = { todo: [], doing: [], done: [] };
  for (const task of tasks) groups[task.status].push(task);
  return groups;
}

/** สรุปจำนวนงานต่อผู้รับผิดชอบ เรียงจากมากไปน้อย */
export function groupByAssignee(
  tasks: TaskRecord[],
): Array<{ assignee: string; total: number; open: number }> {
  const map = new Map<string, { total: number; open: number }>();
  for (const task of tasks) {
    const key = task.assignee ?? "ยังไม่มอบหมาย";
    const entry = map.get(key) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (task.status !== "done") entry.open += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([assignee, value]) => ({ assignee, ...value }))
    .sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee, "th"));
}

/** แบ่งงานตามช่วงครบกำหนด */
export function dueBuckets(
  tasks: TaskRecord[],
  now = Date.now(),
): { overdue: number; today: number; thisWeek: number; later: number; none: number } {
  const buckets = { overdue: 0, today: 0, thisWeek: 0, later: 0, none: 0 };
  const today = isoDay(now);
  const weekEnd = isoDay(endOfWeek(now));
  for (const task of tasks) {
    if (task.status === "done") continue;
    if (!task.dueDate) {
      buckets.none += 1;
      continue;
    }
    if (task.dueDate < today) buckets.overdue += 1;
    else if (task.dueDate === today) buckets.today += 1;
    else if (task.dueDate <= weekEnd) buckets.thisWeek += 1;
    else buckets.later += 1;
  }
  return buckets;
}

/** นับ tag ที่ใช้บ่อยที่สุด */
export function topTags(
  tasks: TaskRecord[],
  limit = 8,
): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const tag of task.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(1, limit));
}
