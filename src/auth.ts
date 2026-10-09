import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "./env";

const COOKIE = "sid";
const SESSION_DAYS = 30;
const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

// 逐字节比较，耗时和内容无关，避免通过响应时间猜出密码。
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// 识别身份：带 API 令牌的是命令行或 Claude，带登录 cookie 的是网页后台，其他都是访客。
export const identify: MiddlewareHandler<AppEnv> = async (c, next) => {
  let authed = false;
  let actor: AppEnv["Variables"]["actor"] = "web";
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (c.env.API_TOKEN && token && constantTimeEqual(token, c.env.API_TOKEN)) {
      authed = true;
      actor = c.req.header("x-actor") === "claude" ? "claude" : "cli";
    }
  } else if (c.env.SESSION_SECRET) {
    const value = await getSignedCookie(c, c.env.SESSION_SECRET, COOKIE);
    if (value && Number(value) > Date.now()) authed = true;
  }
  c.set("authed", authed);
  c.set("actor", actor);
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("authed")) return c.json({ error: "需要先登录" }, 401);
  await next();
};

function isHttps(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export async function startSession(c: Context<AppEnv>): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  await setSignedCookie(c, COOKIE, String(expires), c.env.SESSION_SECRET, {
    httpOnly: true,
    secure: isHttps(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { path: "/", secure: isHttps(c) });
}

export type LoginResult = "ok" | "wrong" | "locked" | "not-configured";

// 校验后台密码。15 分钟内失败 10 次就暂时锁住，防止有人暴力猜密码。
export async function checkPassword(db: D1Database, expected: string | undefined, given: string): Promise<LoginResult> {
  if (!expected) return "not-configured";
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0 AND at > ?")
    .bind(since)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= MAX_FAILURES) return "locked";

  const ok = constantTimeEqual(given, expected);
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  await db.batch([
    db.prepare("INSERT INTO login_attempts (at, ok) VALUES (?, ?)").bind(now, ok ? 1 : 0),
    db.prepare("DELETE FROM login_attempts WHERE at < ?").bind(dayAgo),
  ]);
  return ok ? "ok" : "wrong";
}
