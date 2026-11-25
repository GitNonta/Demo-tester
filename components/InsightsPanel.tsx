import type { CSSProperties } from "react";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
} from "@/lib/task-model";
import { formatDays, formatPercent, type Metrics } from "@/lib/task-metrics";

interface InsightsPanelProps {
  metrics: Metrics;
}

const CARD_STYLE: CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dee5",
  borderRadius: 8,
  padding: 14,
};

const LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#647385",
};

const VALUE_STYLE: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 24,
  fontWeight: 600,
  color: "#1d2733",
};

/** การ์ดตัวเลขหนึ่งใบ */
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div style={CARD_STYLE}>
      <p style={LABEL_STYLE}>{label}</p>
      <p style={VALUE_STYLE}>{value}</p>
      {hint ? (
        <p style={{ ...LABEL_STYLE, marginTop: 2, fontSize: 11 }}>{hint}</p>
      ) : null}
    </div>
  );
}

/** แท่งแนวนอนแสดงสัดส่วน */
function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#647385",
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        role="presentation"
        style={{ background: "#eef1f4", borderRadius: 4, height: 6 }}
      >
        <div
          style={{
            width: `${width}%`,
            background: color,
            height: 6,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

/** สรุปตัวเลขทั้งหมดของงาน ใช้บนหน้า /insights */
export default function InsightsPanel({ metrics }: InsightsPanelProps) {
  const maxStatus = Math.max(
    metrics.byStatus.todo,
    metrics.byStatus.doing,
    metrics.byStatus.done,
    1,
  );
  const maxPriority = Math.max(
    ...PRIORITIES.map((priority) => metrics.byPriority[priority]),
    1,
  );
  const maxThroughput = Math.max(
    ...metrics.throughput.map((point) => point.completed),
    1,
  );

  return (
    <section aria-label="สรุปภาพรวมงาน" style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 16,
        }}
      >
        <Stat label="งานทั้งหมด" value={metrics.total} />
        <Stat label="ยังไม่เสร็จ" value={metrics.open} />
        <Stat
          label="อัตราเสร็จ"
          value={formatPercent(metrics.completionRate)}
          hint={`เสร็จ ${metrics.byStatus.done} จาก ${metrics.total}`}
        />
        <Stat label="เลยกำหนด" value={metrics.overdue} hint="ยังไม่ปิดงาน" />
        <Stat label="ครบกำหนดวันนี้" value={metrics.dueToday} />
        <Stat
          label="ยังไม่มอบหมาย"
          value={metrics.unassigned}
          hint="ไม่มีผู้รับผิดชอบ"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>ตามสถานะ</h3>
          {STATUSES.map((status) => (
            <Bar
              key={status}
              label={STATUS_LABEL[status]}
              value={metrics.byStatus[status]}
              max={maxStatus}
              color="#1f6feb"
            />
          ))}
        </div>

        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>ตามความสำคัญ</h3>
          {PRIORITIES.map((priority) => (
            <Bar
              key={priority}
              label={PRIORITY_LABEL[priority]}
              value={metrics.byPriority[priority]}
              max={maxPriority}
              color={priority === "urgent" ? "#d1242f" : "#8250df"}
            />
          ))}
        </div>

        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>
            งานที่เสร็จ 7 วันล่าสุด
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              height: 90,
            }}
          >
            {metrics.throughput.map((point) => (
              <div
                key={point.day}
                style={{ flex: 1, textAlign: "center" }}
                title={`${point.day}: ${point.completed} งาน`}
              >
                <div
                  style={{
                    height: `${Math.round((point.completed / maxThroughput) * 64)}px`,
                    minHeight: 2,
                    background: "#1f6feb",
                    borderRadius: 3,
                  }}
                />
                <span style={{ fontSize: 10, color: "#647385" }}>
                  {point.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>ระยะเวลาทำงาน</h3>
          <dl style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "#647385" }}>เฉลี่ย</dt>
              <dd style={{ margin: 0 }}>{formatDays(metrics.cycleTime.avgDays)}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "#647385" }}>มัธยฐาน</dt>
              <dd style={{ margin: 0 }}>
                {formatDays(metrics.cycleTime.medianDays)}
              </dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "#647385" }}>P90</dt>
              <dd style={{ margin: 0 }}>{formatDays(metrics.cycleTime.p90Days)}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "#647385" }}>จำนวนงานที่ใช้คำนวณ</dt>
              <dd style={{ margin: 0 }}>{metrics.cycleTime.samples}</dd>
            </div>
          </dl>
          {metrics.oldestOpen ? (
            <p style={{ ...LABEL_STYLE, marginTop: 10 }}>
              งานค้างนานสุด: #{metrics.oldestOpen.id} {metrics.oldestOpen.title} (
              {formatDays(metrics.oldestOpen.ageDays)})
            </p>
          ) : null}
        </div>

        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>ภาระงานต่อคน</h3>
          {metrics.byAssignee.slice(0, 6).map((row) => (
            <div
              key={row.assignee}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                padding: "3px 0",
                borderBottom: "1px solid #eef1f4",
              }}
            >
              <span>{row.assignee}</span>
              <span style={{ color: "#647385" }}>
                {row.open} ค้าง / {row.total} ทั้งหมด
              </span>
            </div>
          ))}
        </div>

        <div style={CARD_STYLE}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Tag ที่ใช้บ่อย</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {metrics.topTags.map((entry) => (
              <span
                key={entry.tag}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "#eef4ff",
                  color: "#1f6feb",
                }}
              >
                {entry.tag} · {entry.count}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
