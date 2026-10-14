import type { Task } from "../../content/schema.ts";

// 手画的方框清单；做完的打红勾
export function TaskList({ tasks, label }: { tasks: Task[]; label: string }) {
  return (
    <ul className="checks" aria-label={label}>
      {tasks.map((t) => (
        <li key={t.id} className={t.done ? "check is-done" : "check"}>
          <span className="check-box" aria-hidden="true">
            {t.done ? (
              <svg viewBox="0 0 20 20">
                <path d="M3.5 10.5l4.2 4.3L16.8 4.6" />
              </svg>
            ) : null}
          </span>
          <span className="check-text">
            {t.title}
            <span className="sr-only">{t.done ? "（已完成）" : "（未完成）"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
