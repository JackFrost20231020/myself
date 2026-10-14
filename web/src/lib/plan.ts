import type { Plan, Week } from "../../content/schema.ts";

// 今天在计划里处于什么位置
export type WeekStatus =
  | { kind: "empty" }
  | { kind: "before"; next: Week }
  | { kind: "current"; week: Week; next: Week | undefined }
  | { kind: "gap"; next: Week }
  | { kind: "after"; last: Week };

export function weekStatus(plan: Plan, today: string): WeekStatus {
  const weeks = plan.weeks;
  const first = weeks[0];
  const last = weeks.at(-1);
  if (!first || !last) return { kind: "empty" };
  if (today < first.start) return { kind: "before", next: first };
  if (today > last.end) return { kind: "after", last };
  const i = weeks.findIndex((w) => w.start <= today && today <= w.end);
  if (i >= 0) return { kind: "current", week: weeks[i]!, next: weeks[i + 1] };
  // 两周之间有空档（计划里没排的日子）
  const next = weeks.find((w) => w.start > today)!;
  return { kind: "gap", next };
}

// w1 → 1
export function weekNumber(week: Week): number {
  return Number(week.id.slice(1));
}

export function doneCount(week: Week): number {
  return week.tasks.filter((t) => t.done).length;
}

export type WeekTense = "past" | "current" | "future";

export function weekTense(week: Week, today: string): WeekTense {
  if (today > week.end) return "past";
  if (today < week.start) return "future";
  return "current";
}
