"use client";

import { useEffect, useState } from "react";
import type { Status, Task } from "@/lib/tasks";

const COLUMNS: { key: Status; label: string }[] = [
  { key: "todo", label: "รอทำ" },
  { key: "doing", label: "กำลังทำ" },
  { key: "done", label: "เสร็จแล้ว" },
];

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const load = async () => {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setTitle("");
    load();
  };

  const move = async (id: number, status: Status) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div>
      <div className="add">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="เพิ่มงานใหม่"
          aria-label="ชื่องานใหม่"
        />
        <button onClick={add}>เพิ่มงาน</button>
      </div>

      <div className="columns">
        {COLUMNS.map((col) => (
          <section key={col.key} className="column">
            <h2>{col.label}</h2>
            {tasks
              .filter((t) => t.status === col.key)
              .map((t) => (
                <article key={t.id} className="task">
                  <p>{t.title}</p>
                  <div className="actions">
                    <select
                      value={t.status}
                      onChange={(e) => move(t.id, e.target.value as Status)}
                      aria-label={`ย้ายสถานะ ${t.title}`}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button className="ghost" onClick={() => remove(t.id)}>
                      ลบ
                    </button>
                  </div>
                </article>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
