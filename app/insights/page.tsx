"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FilterBar, { INITIAL_FILTER, type FilterState } from "@/components/FilterBar";
import InsightsPanel from "@/components/InsightsPanel";
import TaskTable from "@/components/TaskTable";
import type { Metrics } from "@/lib/task-metrics";
import type { QueryResult } from "@/lib/task-query";
import type { TaskEvent } from "@/lib/task-model";

/** แปลงสถานะตัวกรองเป็น query string ของ API */
function buildParams(filter: FilterState, page: number): string {
  const params = new URLSearchParams();
  if (filter.q.trim()) params.set("q", filter.q.trim());
  for (const status of filter.statuses) params.append("status", status);
  for (const priority of filter.priorities) params.append("priority", priority);
  if (filter.tag.trim()) params.set("tag", filter.tag.trim());
  if (filter.assignee.trim()) params.set("assignee", filter.assignee.trim());
  if (filter.due !== "any") params.set("due", filter.due);
  params.set("sort", `${filter.sortField}:${filter.sortDirection}`);
  params.set("page", String(page));
  params.set("pageSize", String(filter.pageSize));
  return params.toString();
}

export default function InsightsPage() {
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => buildParams(filter, page), [filter, page]);

  // เปลี่ยนตัวกรองเมื่อไรให้กลับไปหน้าแรกเสมอ
  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/tasks/query?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`โหลดรายการงานไม่สำเร็จ (${response.status})`);
        return (await response.json()) as QueryResult;
      })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "เกิดข้อผิดพลาด");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/insights")
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดสรุปไม่สำเร็จ");
        return (await response.json()) as { metrics: Metrics };
      })
      .then((data) => {
        if (!cancelled) setMetrics(data.metrics);
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      });

    fetch("/api/history?limit=10")
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดประวัติไม่สำเร็จ");
        return (await response.json()) as { events: TaskEvent[] };
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilter((current) => ({ ...current, ...patch }));
  };

  const changePage = (next: number) => {
    if (!result) return;
    setPage(Math.min(Math.max(next, 1), result.pages));
  };

  return (
    <main>
      <p style={{ margin: "0 0 4px", fontSize: 13 }}>
        <Link href="/" style={{ color: "#1f6feb" }}>
          กลับไปหน้ากระดาน
        </Link>
      </p>
      <h1>Task Insights</h1>
      <p className="sub">
        สรุปตัวเลข ค้นหา และกรองงานทั้งหมดจาก API ใหม่ (/api/tasks/query,
        /api/insights)
      </p>

      {metrics ? <InsightsPanel metrics={metrics} /> : null}

      <FilterBar
        value={filter}
        total={result?.total ?? 0}
        loading={loading}
        onChange={updateFilter}
        onReset={() => {
          setFilter(INITIAL_FILTER);
          setPage(1);
        }}
      />

      {error ? (
        <p
          role="alert"
          style={{ color: "#d1242f", marginBottom: 12, fontSize: 14 }}
        >
          {error}
        </p>
      ) : null}

      <TaskTable items={result?.items ?? []} />

      <nav
        aria-label="การแบ่งหน้า"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "12px 0 24px",
          fontSize: 13,
          color: "#647385",
        }}
      >
        <span>
          หน้า {result?.page ?? 1} จาก {result?.pages ?? 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => changePage((result?.page ?? 1) - 1)}
            disabled={!result?.hasPrev || loading}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            ก่อนหน้า
          </button>
          <button
            type="button"
            onClick={() => changePage((result?.page ?? 1) + 1)}
            disabled={!result?.hasNext || loading}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            ถัดไป
          </button>
        </span>
      </nav>

      <section aria-label="ประวัติล่าสุด">
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>ประวัติล่าสุด</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
          {events.length === 0 ? (
            <li style={{ color: "#647385" }}>ยังไม่มีเหตุการณ์</li>
          ) : (
            events.map((event) => (
              <li
                key={event.id}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid #eef1f4",
                  color: "#1d2733",
                }}
              >
                <span style={{ color: "#647385" }}>
                  {new Date(event.at).toLocaleString("th-TH")}
                </span>{" "}
                · {event.actor} · {event.detail}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
