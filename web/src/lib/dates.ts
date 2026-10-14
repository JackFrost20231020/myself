// 日期都按北京时间（UTC+8，没有夏令时）算，格式 YYYY-MM-DD。
export function todayInShanghai(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

// 2026-10-12 → 10月12日
export function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

// 2026-10-12 → 10.12
export function dotDate(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}
