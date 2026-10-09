import { getPlatformProxy } from "wrangler";
import initSql from "../migrations/0001_init.sql?raw";

// 用 wrangler 在本地起一个内存里的 D1 数据库，测试跑的是真实的 SQLite 行为。
export async function setupDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  await applySql(db, initSql);
  return { db, dispose: () => proxy.dispose() };
}

export async function applySql(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
}

export async function clearDb(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM entries"),
    db.prepare("DELETE FROM edits"),
    db.prepare("DELETE FROM feed_items"),
    db.prepare("DELETE FROM login_attempts"),
  ]);
}
