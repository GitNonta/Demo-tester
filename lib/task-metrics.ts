import type { Status } from "@/lib/tasks";
import {
  type Priority,
  type TaskRecord,
  daysBetween,
  isoDay,
  isOverdue,
} from "./task-model";
import { groupByAssignee, topTags } from "./task-query";

/** สถิติระยะเวลาทำงาน (หน่วยเป็นวัน) */
export interface CycleTimeStats {
  samples: number;
  avgDays: number;
  medianDays: number;
  p90Days: number;
}

/** จำนวนงานที่เสร็จในแต่ละวัน */
export interface ThroughputPoint {
  day: string;
  completed: number;
}

/** สรุปตัวเลขทั้งหมดที่หน้า insights ใช้ */
export interface Metrics {
  generatedAt: number;
  total: number;
  open: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  completionRate: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  cycleTime: CycleTimeStats;
  throughput: ThroughputPoint[];
  byAssignee: Array<{ assignee: string; total: number; open: number }>;
  topTags: Array<{ tag: string; count: number }>;
  oldestOpen: { id: number; title: string; ageDays: number } | null;
}

/** ค่าเฉลี่ยของรายการตัวเลข (คืน 0 ถ้าไม่มีข้อมูล) */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

/** ค่ามัธยฐานของรายการที่ยังไม่เรียง */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * ค่าเปอร์เซ็นไทล์แบบ nearest-rank
 * p ต้องอยู่ระหว่าง 0 ถึง 100
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const clamped = Math.min(Math.max(p, 0), 100);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((clamped / 100) * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

/** ปัดทศนิยมให้เหลือหนึ่งตำแหน่ง ใช้ก่อนส่งออก JSON */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** วันที่ย้อนหลัง n วัน (รวมวันนี้) เรียงจากเก่าไปใหม่ */
export function lastNDays(n: number, now = Date.now()): string[] {
  const days: string[] = [];
  const count = Math.max(1, Math.min(n, 90));
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(isoDay(now - offset * 86_400_000));
  }
  return days;
}

/** คำนวณระยะเวลาตั้งแต่สร้างจนเสร็จของงานที่ปิดแล้ว */
export function cycleTimeSamples(tasks: TaskRecord[]): number[] {
  return tasks
    .filter((task) => task.status === "done" && task.completedAt !== null)
    .map((task) =>
      Math.max(0, (task.completedAt as number) - task.createdAt) / 86_400_000,
    );
}

/** จำนวนงานที่เสร็จในแต่ละวัน ย้อนหลัง n วัน */
export function throughputSeries(
  tasks: TaskRecord[],
  days = 7,
  now = Date.now(),
): ThroughputPoint[] {
  const buckets = new Map<string, number>();
  for (const day of lastNDays(days, now)) buckets.set(day, 0);
  for (const task of tasks) {
    if (task.completedAt === null) continue;
    const day = isoDay(task.completedAt);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, completed]) => ({ day, completed }));
}

/** สรุปสถานะงานทั้งหมดเป็นตัวเลข */
function countByStatus(tasks: TaskRecord[]): Record<Status, number> {
  const counts: Record<Status, number> = { todo: 0, doing: 0, done: 0 };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

/** สรุปจำนวนงานตามระดับความสำคัญ */
function countByPriority(tasks: TaskRecord[]): Record<Priority, number> {
  const counts: Record<Priority, number> = {
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0,
  };
  for (const task of tasks) counts[task.priority] += 1;
  return counts;
}

/** หางานที่ยังไม่เสร็จและค้างนานที่สุด */
function findOldestOpen(
  tasks: TaskRecord[],
  now: number,
): Metrics["oldestOpen"] {
  const open = tasks.filter((task) => task.status !== "done");
  if (open.length === 0) return null;
  const oldest = open.reduce((acc, task) =>
    task.createdAt < acc.createdAt ? task : acc,
  );
  return {
    id: oldest.id,
    title: oldest.title,
    ageDays: daysBetween(oldest.createdAt, now),
  };
}

/**
 * รวมทุกตัวเลขที่ต้องใช้บนหน้า insights
 * รับ tasks ที่ยังไม่ถูกลบเท่านั้น (ผู้เรียกเป็นคนกรอง)
 */
export function summarize(tasks: TaskRecord[], now = Date.now()): Metrics {
  const byStatus = countByStatus(tasks);
  const total = tasks.length;
  const open = total - byStatus.done;
  const samples = cycleTimeSamples(tasks);
  const completionRate = total === 0 ? 0 : byStatus.done / total;

  return {
    generatedAt: now,
    total,
    open,
    byStatus,
    byPriority: countByPriority(tasks),
    completionRate: Math.round(completionRate * 100) / 100,
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
    dueToday: tasks.filter(
      (task) => task.status !== "done" && task.dueDate === isoDay(now),
    ).length,
    unassigned: tasks.filter((task) => task.assignee === null).length,
    cycleTime: {
      samples: samples.length,
      avgDays: round1(average(samples)),
      medianDays: round1(median(samples)),
      p90Days: round1(percentile(samples, 90)),
    },
    throughput: throughputSeries(tasks, 7, now),
    byAssignee: groupByAssignee(tasks),
    topTags: topTags(tasks, 8),
    oldestOpen: findOldestOpen(tasks, now),
  };
}

/** แปลงสัดส่วนเป็นข้อความเปอร์เซ็นต์ */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** แปลงจำนวนวันเป็นข้อความอ่านง่าย */
export function formatDays(days: number): string {
  if (days <= 0) return "วันนี้";
  if (days < 1) return `${Math.round(days * 24)} ชม.`;
  if (days < 30) return `${round1(days)} วัน`;
  return `${Math.round(days / 30)} เดือน`;
}
