import { listTasks, type Status } from "@/lib/tasks";
import {
  type CreateTaskInput,
  type TaskEvent,
  type TaskEventType,
  type TaskRecord,
  type UpdateTaskInput,
  ValidationError,
  normalizeAssignee,
  normalizeDueDate,
  normalizeTags,
  normalizeTitle,
  parsePriority,
  parseStatus,
} from "./task-model";

/** ผู้กระทำเริ่มต้นเมื่อไม่ได้ระบุว่าใครเป็นคนแก้ */
const DEFAULT_ACTOR = "system";

/** จำนวนรายการใน undo stack สูงสุด */
const UNDO_LIMIT = 50;

/** ตัวรับฟังการเปลี่ยนแปลงของ store */
export type RepositoryListener = (change: {
  type: TaskEventType;
  taskId: number;
}) => void;

/** รายการที่สามารถย้อนกลับได้หนึ่งรายการ */
interface UndoEntry {
  label: string;
  undo: () => void;
}

/**
 * สร้างงานตัวอย่างเริ่มต้นโดยอ้างอิงเวลาปัจจุบัน
 * ใช้เฉพาะตอนที่ยังไม่มีข้อมูลในหน่วยความจำ
 */
function buildSeedTasks(now: number): TaskRecord[] {
  const hour = 3_600_000;
  const day = 86_400_000;
  const isoDay = (offset: number) =>
    new Date(now + offset * day).toISOString().slice(0, 10);

  const seeds: Array<
    Pick<TaskRecord, "title" | "status" | "priority" | "tags" | "assignee" | "dueDate">
  > = [
    {
      title: "ตั้งค่า GitHub App ให้ repo ทดสอบ",
      status: "done",
      priority: "high",
      tags: ["setup", "github"],
      assignee: "GitNonta",
      dueDate: isoDay(-6),
    },
    {
      title: "เปิด Pull Request แรกจาก branch ทดสอบ",
      status: "done",
      priority: "normal",
      tags: ["flow", "github"],
      assignee: "Nontawatpkru17",
      dueDate: isoDay(-4),
    },
    {
      title: "ตรวจว่าระบบแจกงานรีวิวเลือก reviewer ถูกคน",
      status: "doing",
      priority: "urgent",
      tags: ["review", "automation"],
      assignee: "Themynon2",
      dueDate: isoDay(1),
    },
    {
      title: "เขียนเทสต์สำหรับ API /api/tasks",
      status: "doing",
      priority: "high",
      tags: ["test", "api"],
      assignee: "Nontawatpkru17",
      dueDate: isoDay(2),
    },
    {
      title: "เพิ่มตัวกรองตาม tag ในหน้ากระดาน",
      status: "todo",
      priority: "normal",
      tags: ["ui", "filter"],
      assignee: null,
      dueDate: isoDay(5),
    },
    {
      title: "สรุป throughput รายสัปดาห์",
      status: "todo",
      priority: "high",
      tags: ["metrics", "report"],
      assignee: "GitNonta",
      dueDate: isoDay(3),
    },
    {
      title: "เก็บ activity log ของทุกการเปลี่ยนสถานะ",
      status: "done",
      priority: "normal",
      tags: ["audit", "metrics"],
      assignee: "GitNonta",
      dueDate: isoDay(-2),
    },
    {
      title: "รองรับวันครบกำหนดแบบเลทโซน",
      status: "todo",
      priority: "low",
      tags: ["date", "backend"],
      assignee: null,
      dueDate: null,
    },
    {
      title: "ทำปุ่มย้อนกลับการลบงาน",
      status: "todo",
      priority: "urgent",
      tags: ["undo", "safety"],
      assignee: "Themynon2",
      dueDate: isoDay(0),
    },
    {
      title: "ปรับข้อความว่างของแต่ละคอลัมน์",
      status: "doing",
      priority: "low",
      tags: ["ui"],
      assignee: "Nontawatpkru17",
      dueDate: isoDay(7),
    },
    {
      title: "ตรวจว่า CI ผ่านก่อน merge ทุกครั้ง",
      status: "done",
      priority: "high",
      tags: ["ci", "process"],
      assignee: "GitNonta",
      dueDate: isoDay(-1),
    },
    {
      title: "เขียนคู่มือทดสอบระบบรีวิว",
      status: "todo",
      priority: "normal",
      tags: ["docs"],
      assignee: "Themynon2",
      dueDate: null,
    },
  ];

  return seeds.map((seed, index) => {
    const createdAt = now - (seeds.length - index) * hour * 6;
    const completedAt =
      seed.status === "done" ? createdAt + Math.round(day * 0.5) : null;
    return {
      id: 1001 + index,
      title: seed.title,
      status: seed.status,
      priority: seed.priority,
      tags: [...seed.tags].sort(),
      assignee: seed.assignee,
      dueDate: seed.dueDate,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      completedAt,
      deletedAt: null,
    } satisfies TaskRecord;
  });
}

/**
 * ที่เก็บงานในหน่วยความจำ พร้อม activity log และ undo stack
 * ออกแบบให้ทดสอบได้ง่าย: ไม่พึ่งฐานข้อมูลและไม่เขียนลงดิสก์
 */
export class TaskRepository {
  private tasks = new Map<number, TaskRecord>();
  private events: TaskEvent[] = [];
  private nextTaskId = 1;
  private nextEventId = 1;
  private undoStack: UndoEntry[] = [];
  private listeners = new Set<RepositoryListener>();

  constructor(seed: TaskRecord[] = buildSeedTasks(Date.now())) {
    for (const task of seed) {
      this.tasks.set(task.id, task);
      this.nextTaskId = Math.max(this.nextTaskId, task.id + 1);
      this.events.push({
        id: this.nextEventId++,
        taskId: task.id,
        type: "created",
        at: task.createdAt,
        actor: task.assignee ?? DEFAULT_ACTOR,
        detail: `สร้างงาน "${task.title}"`,
      });
    }
    this.events.sort((a, b) => a.at - b.at);
  }

  /** สมัครรับการแจ้งเตือนเมื่อข้อมูลเปลี่ยน คืนฟังก์ชันยกเลิก */
  subscribe(listener: RepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * ดึงงานที่ถูกสร้างผ่าน store เดิม (lib/tasks.ts) เข้ามาในที่เก็บนี้
   * ทำให้หน้า /insights เห็นงานชุดเดียวกับหน้าหลัก
   */
  syncLegacy(): void {
    const now = Date.now();
    for (const legacy of listTasks()) {
      if (this.tasks.has(legacy.id)) continue;
      this.tasks.set(legacy.id, {
        id: legacy.id,
        title: legacy.title,
        status: legacy.status,
        priority: "normal",
        tags: [],
        assignee: null,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
        completedAt: legacy.status === "done" ? now : null,
        deletedAt: null,
      });
      this.nextTaskId = Math.max(this.nextTaskId, legacy.id + 1);
      this.events.push({
        id: this.nextEventId++,
        taskId: legacy.id,
        type: "created",
        at: now,
        actor: DEFAULT_ACTOR,
        detail: `สร้างงาน "${legacy.title}" จากหน้าหลัก`,
      });
    }
  }

  /** คืนงานทั้งหมด เรียงจากเวลาอัปเดตล่าสุด */
  all(options: { includeDeleted?: boolean } = {}): TaskRecord[] {
    this.syncLegacy();
    const tasks = [...this.tasks.values()];
    const filtered = options.includeDeleted
      ? tasks
      : tasks.filter((task) => task.deletedAt === null);
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** หางานตาม id คืน undefined ถ้าไม่พบหรือถูกลบแล้ว */
  find(id: number, options: { includeDeleted?: boolean } = {}): TaskRecord | undefined {
    this.syncLegacy();
    const task = this.tasks.get(id);
    if (!task) return undefined;
    if (!options.includeDeleted && task.deletedAt !== null) return undefined;
    return task;
  }

  /** จำนวนงานที่ยังไม่ถูกลบ (รวมทุกสถานะ) */
  count(): number {
    return this.all().length;
  }

  /** เพิ่มงานใหม่จากข้อมูลดิบที่ยังไม่ผ่าน validation */
  create(input: CreateTaskInput, actor = DEFAULT_ACTOR): TaskRecord {
    const now = Date.now();
    const task: TaskRecord = {
      id: this.nextTaskId++,
      title: normalizeTitle(input.title),
      status: input.status === undefined ? "todo" : parseStatus(input.status),
      priority:
        input.priority === undefined ? "normal" : parsePriority(input.priority),
      tags: normalizeTags(input.tags),
      assignee: normalizeAssignee(input.assignee),
      dueDate: normalizeDueDate(input.dueDate),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null,
    };
    if (task.status === "done") task.completedAt = now;
    this.tasks.set(task.id, task);
    this.record(task.id, "created", actor, `สร้างงาน "${task.title}"`);
    return task;
  }

  /** แก้ไขฟิลด์ต่าง ๆ ของงาน ตรวจ validation ทุกครั้ง */
  update(id: number, input: UpdateTaskInput, actor = DEFAULT_ACTOR): TaskRecord {
    const current = this.requireTask(id);
    const next: TaskRecord = { ...current };
    const changed: string[] = [];

    if (input.title !== undefined) {
      const title = normalizeTitle(input.title);
      if (title !== current.title) changed.push("title");
      next.title = title;
    }
    if (input.status !== undefined) {
      const status = parseStatus(input.status);
      if (status !== current.status) {
        changed.push("status");
        next.status = status;
        next.completedAt = status === "done" ? Date.now() : null;
      }
    }
    if (input.priority !== undefined) {
      const priority = parsePriority(input.priority);
      if (priority !== current.priority) changed.push("priority");
      next.priority = priority;
    }
    if (input.tags !== undefined) {
      const tags = normalizeTags(input.tags);
      if (tags.join(",") !== current.tags.join(",")) changed.push("tags");
      next.tags = tags;
    }
    if (input.assignee !== undefined) {
      const assignee = normalizeAssignee(input.assignee);
      if (assignee !== current.assignee) changed.push("assignee");
      next.assignee = assignee;
    }
    if (input.dueDate !== undefined) {
      const dueDate = normalizeDueDate(input.dueDate);
      if (dueDate !== current.dueDate) changed.push("dueDate");
      next.dueDate = dueDate;
    }

    if (changed.length === 0) return current;

    const snapshot = { ...current };
    next.updatedAt = Date.now();
    this.tasks.set(id, next);
    this.pushUndo(`แก้ไขงาน #${id}`, () => this.tasks.set(id, snapshot));
    this.record(
      id,
      changed.includes("status") ? "status-changed" : "updated",
      actor,
      `แก้ไข ${changed.join(", ")}`,
    );
    return next;
  }

  /** เปลี่ยนสถานะงานโดยไม่ต้องส่งฟิลด์อื่น */
  setStatus(id: number, status: Status, actor = DEFAULT_ACTOR): TaskRecord {
    return this.update(id, { status }, actor);
  }

  /** ลบงานแบบ soft delete ยังกู้คืนได้ผ่าน restore หรือ undo */
  softDelete(id: number, actor = DEFAULT_ACTOR): TaskRecord {
    const current = this.requireTask(id);
    const snapshot = { ...current };
    const next: TaskRecord = { ...current, deletedAt: Date.now(), updatedAt: Date.now() };
    this.tasks.set(id, next);
    this.pushUndo(`ลบงาน #${id}`, () => this.tasks.set(id, snapshot));
    this.record(id, "deleted", actor, `ลบงาน "${current.title}"`);
    return next;
  }

  /** กู้คืนงานที่ถูกลบ */
  restore(id: number, actor = DEFAULT_ACTOR): TaskRecord {
    const task = this.tasks.get(id);
    if (!task) throw new ValidationError("id", "ไม่พบงาน");
    if (task.deletedAt === null) return task;
    const snapshot = { ...task };
    const next: TaskRecord = { ...task, deletedAt: null, updatedAt: Date.now() };
    this.tasks.set(id, next);
    this.pushUndo(`กู้คืนงาน #${id}`, () => this.tasks.set(id, snapshot));
    this.record(id, "restored", actor, `กู้คืนงาน "${task.title}"`);
    return next;
  }

  /** ย้อนกลับการกระทำล่าสุด คืนข้อความที่อธิบายสิ่งที่ย้อน */
  undo(actor = DEFAULT_ACTOR): string | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    entry.undo();
    this.record(0, "undone", actor, entry.label);
    return entry.label;
  }

  /** ประวัติเหตุการณ์ทั้งหมด หรือเฉพาะงานที่ระบุ */
  history(taskId?: number): TaskEvent[] {
    const events =
      taskId === undefined
        ? [...this.events]
        : this.events.filter((event) => event.taskId === taskId);
    return events.sort((a, b) => b.at - a.at);
  }

  /** จำนวนรายการที่ย้อนกลับได้ตอนนี้ */
  undoCount(): number {
    return this.undoStack.length;
  }

  /** ล้างข้อมูลทั้งหมดแล้วใส่ seed ใหม่ ใช้ในเทสต์ */
  reset(seed: TaskRecord[] = buildSeedTasks(Date.now())): void {
    this.tasks.clear();
    this.events = [];
    this.undoStack = [];
    this.nextTaskId = 1;
    this.nextEventId = 1;
    for (const task of seed) {
      this.tasks.set(task.id, task);
      this.nextTaskId = Math.max(this.nextTaskId, task.id + 1);
    }
  }

  private requireTask(id: number): TaskRecord {
    const task = this.find(id);
    if (!task) throw new ValidationError("id", `ไม่พบงานหมายเลข ${id}`);
    return task;
  }

  private pushUndo(label: string, undo: () => void): void {
    this.undoStack.push({ label, undo });
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
  }

  private record(
    taskId: number,
    type: TaskEventType,
    actor: string,
    detail: string,
  ): void {
    this.events.push({
      id: this.nextEventId++,
      taskId,
      type,
      at: Date.now(),
      actor: actor || DEFAULT_ACTOR,
      detail,
    });
    for (const listener of this.listeners) {
      listener({ type, taskId });
    }
  }
}

/**
 * อินสแตนซ์เดียวที่ใช้ร่วมกันทั้งแอป
 * หมายเหตุ: เก็บในหน่วยความจำ จึงรีเซ็ตเมื่อ process รีสตาร์ต
 */
export const taskRepository = new TaskRepository();

/** ใช้ในเทสต์เพื่อสร้าง store ที่แยกจากตัวหลัก */
export function createRepository(seed?: TaskRecord[]): TaskRepository {
  return new TaskRepository(seed);
}
