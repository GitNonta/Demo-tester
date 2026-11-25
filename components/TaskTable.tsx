import type { CSSProperties } from "react";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  type TaskRecord,
} from "@/lib/task-model";

interface TaskTableProps {
  items: TaskRecord[];
  now?: number;
}

const CELL: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eef1f4",
  fontSize: 13,
  textAlign: "left",
  verticalAlign: "top",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "#647385",
  normal: "#1f6feb",
  high: "#bf8700",
  urgent: "#d1242f",
};

/** ตารางรายการงานที่ผ่านตัวกรองแล้ว */
export default function TaskTable({ items, now = Date.now() }: TaskTableProps) {
  if (items.length === 0) {
    return (
      <p
        style={{
          padding: 24,
          textAlign: "center",
          color: "#647385",
          border: "1px dashed #d8dee5",
          borderRadius: 8,
        }}
      >
        ไม่พบงานที่ตรงกับเงื่อนไข
      </p>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid #d8dee5",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <caption
          style={{
            textAlign: "left",
            padding: "10px 12px",
            fontSize: 13,
            color: "#647385",
          }}
        >
          รายการงาน ({items.length})
        </caption>
        <thead>
          <tr>
            <th style={{ ...CELL, width: 48 }}>#</th>
            <th style={CELL}>ชื่องาน</th>
            <th style={CELL}>สถานะ</th>
            <th style={CELL}>ความสำคัญ</th>
            <th style={CELL}>Tag</th>
            <th style={CELL}>ผู้รับผิดชอบ</th>
            <th style={CELL}>ครบกำหนด</th>
          </tr>
        </thead>
        <tbody>
          {items.map((task) => {
            const overdue = isOverdue(task, now);
            return (
              <tr key={task.id}>
                <td style={{ ...CELL, color: "#647385" }}>{task.id}</td>
                <td style={CELL}>
                  {task.title}
                  {task.deletedAt !== null ? (
                    <span style={{ color: "#d1242f" }}> (ลบแล้ว)</span>
                  ) : null}
                </td>
                <td style={CELL}>{STATUS_LABEL[task.status]}</td>
                <td
                  style={{
                    ...CELL,
                    color: PRIORITY_COLOR[task.priority] ?? "#1d2733",
                    fontWeight: 600,
                  }}
                >
                  {PRIORITY_LABEL[task.priority]}
                </td>
                <td style={CELL}>
                  {task.tags.length === 0 ? (
                    <span style={{ color: "#9aa7b4" }}>—</span>
                  ) : (
                    task.tags.join(", ")
                  )}
                </td>
                <td style={CELL}>
                  {task.assignee ?? (
                    <span style={{ color: "#9aa7b4" }}>ยังไม่มอบหมาย</span>
                  )}
                </td>
                <td
                  style={{
                    ...CELL,
                    color: overdue ? "#d1242f" : "#1d2733",
                    fontWeight: overdue ? 600 : 400,
                  }}
                >
                  {task.dueDate ?? "—"}
                  {overdue ? " (เลยกำหนด)" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
