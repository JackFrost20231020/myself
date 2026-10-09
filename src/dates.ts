// 北京时间（UTC+8，没有夏令时）的今天，格式 YYYY-MM-DD。
export function todayInShanghai(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

// 把 ISO 时间显示成北京时间，例如 10-09 14:30。
export function formatShanghai(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Date(d.getTime() + 8 * 3_600_000).toISOString();
  return (withYear ? s.slice(0, 10) : s.slice(5, 10)) + " " + s.slice(11, 16);
}

// 2026-10-12 → 10/12
export function shortDate(date: unknown): string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}
