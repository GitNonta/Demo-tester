"use client";

import type { CSSProperties } from "react";
import type { Status } from "@/lib/tasks";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Priority,
} from "@/lib/task-model";
import type { DueFilter, SortField } from "@/lib/task-query";

/** สถานะตัวกรองทั้งหมดที่หน้า insights เก็บไว้ */
export interface FilterState {
  q: string;
  statuses: Status[];
  priorities: Priority[];
  tag: string;
  assignee: string;
  due: DueFilter;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  pageSize: number;
}

/** ค่าเริ่มต้นของตัวกรอง ใช้ทั้งตอนเปิดหน้าและตอนกดรีเซ็ต */
export const INITIAL_FILTER: FilterState = {
  q: "",
  statuses: [],
  priorities: [],
  tag: "",
  assignee: "",
  due: "any",
  sortField: "updatedAt",
  sortDirection: "desc",
  pageSize: 10,
};

interface FilterBarProps {
  value: FilterState;
  total: number;
  loading: boolean;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
}

const FIELD_STYLE: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d8dee5",
  background: "#fff",
  minWidth: 0,
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  color: "#647385",
  display: "block",
  marginBottom: 4,
};

/** สลับค่าหนึ่งค่าในอาร์เรย์ (ใช้กับปุ่มเลือกหลายค่า) */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/** แถบตัวกรอง: คำค้น, สถานะ, ความสำคัญ, tag, ผู้รับผิดชอบ, ครบกำหนด, การเรียง */
export default function FilterBar({
  value,
  total,
  loading,
  onChange,
  onReset,
}: FilterBarProps) {
  return (
    <section
      aria-label="ตัวกรองงาน"
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        border: "1px solid #d8dee5",
        borderRadius: 8,
        background: "#fff",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr 1fr" }}>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-q">
            ค้นหา (ชื่อ, tag, ผู้รับผิดชอบ)
          </label>
          <input
            id="filter-q"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.q}
            placeholder="เช่น metrics หรือ #4"
            onChange={(event) => onChange({ q: event.target.value })}
          />
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-tag">
            Tag
          </label>
          <input
            id="filter-tag"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.tag}
            placeholder="เช่น ui"
            onChange={(event) => onChange({ tag: event.target.value })}
          />
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-assignee">
            ผู้รับผิดชอบ
          </label>
          <input
            id="filter-assignee"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.assignee}
            placeholder="ชื่อผู้ใช้"
            onChange={(event) => onChange({ assignee: event.target.value })}
          />
        </div>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={LABEL_STYLE}>สถานะ</legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUSES.map((status) => {
            const active = value.statuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ statuses: toggle(value.statuses, status) })}
                style={{
                  ...FIELD_STYLE,
                  cursor: "pointer",
                  background: active ? "#1f6feb" : "#fff",
                  color: active ? "#fff" : "#1d2733",
                  borderColor: active ? "#1f6feb" : "#d8dee5",
                }}
              >
                {STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={LABEL_STYLE}>ความสำคัญ</legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRIORITIES.map((priority) => {
            const active = value.priorities.includes(priority);
            return (
              <button
                key={priority}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({ priorities: toggle(value.priorities, priority) })
                }
                style={{
                  ...FIELD_STYLE,
                  cursor: "pointer",
                  background: active ? "#1f6feb" : "#fff",
                  color: active ? "#fff" : "#1d2733",
                  borderColor: active ? "#1f6feb" : "#d8dee5",
                }}
              >
                {PRIORITY_LABEL[priority]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-due">
            ครบกำหนด
          </label>
          <select
            id="filter-due"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.due}
            onChange={(event) =>
              onChange({ due: event.target.value as DueFilter })
            }
          >
            <option value="any">ทั้งหมด</option>
            <option value="overdue">เลยกำหนด</option>
            <option value="today">วันนี้</option>
            <option value="week">ภายในสัปดาห์นี้</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-sort">
            เรียงตาม
          </label>
          <select
            id="filter-sort"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.sortField}
            onChange={(event) =>
              onChange({ sortField: event.target.value as SortField })
            }
          >
            <option value="updatedAt">อัปเดตล่าสุด</option>
            <option value="createdAt">สร้างล่าสุด</option>
            <option value="dueDate">วันครบกำหนด</option>
            <option value="priority">ความสำคัญ</option>
            <option value="status">สถานะ</option>
            <option value="title">ชื่อ</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-direction">
            ทิศทาง
          </label>
          <select
            id="filter-direction"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.sortDirection}
            onChange={(event) =>
              onChange({
                sortDirection: event.target.value === "asc" ? "asc" : "desc",
              })
            }
          >
            <option value="desc">มากไปน้อย</option>
            <option value="asc">น้อยไปมาก</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE} htmlFor="filter-pagesize">
            ต่อหน้า
          </label>
          <select
            id="filter-pagesize"
            style={{ ...FIELD_STYLE, width: "100%" }}
            value={value.pageSize}
            onChange={(event) =>
              onChange({ pageSize: Number(event.target.value) })
            }
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#647385",
          fontSize: 13,
        }}
      >
        <span aria-live="polite">
          {loading ? "กำลังโหลด…" : `พบ ${total} งาน`}
        </span>
        <button
          type="button"
          onClick={onReset}
          style={{
            ...FIELD_STYLE,
            cursor: "pointer",
            background: "transparent",
            color: "#647385",
          }}
        >
          ล้างตัวกรอง
        </button>
      </div>
    </section>
  );
}
