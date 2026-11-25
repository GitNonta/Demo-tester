export type Status = "todo" | "doing" | "done";

export interface Task {
  id: number;
  title: string;
  status: Status;
}

// In-memory store (resets on server restart) — fine for demo purposes.
let tasks: Task[] = [
  { id: 1, title: "ตั้งค่า GitHub App", status: "done" },
  { id: 2, title: "เปิด Pull Request แรก", status: "doing" },
  { id: 3, title: "ทดสอบระบบแจกงานรีวิวอัตโนมัติ", status: "todo" },
];
let nextId = 4;

export const listTasks = () => tasks;

export function addTask(title: string): Task {
  const task: Task = { id: nextId++, title, status: "todo" };
  tasks = [...tasks, task];
  return task;
}

export function updateStatus(id: number, status: Status): Task | undefined {
  tasks = tasks.map((t) => (t.id === id ? { ...t, status } : t));
  return tasks.find((t) => t.id === id);
}

export function removeTask(id: number) {
  tasks = tasks.filter((t) => t.id !== id);
}
