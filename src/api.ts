import { Hono, type Context } from "hono";
import { z } from "zod";
import { requireAuth } from "./auth";
import { todayInShanghai } from "./dates";
import type { AppEnv } from "./env";
import { listFeed, refreshAihot } from "./feed";
import { isKind } from "./kinds";
import {
  StoreError,
  createEntry,
  deleteEntry,
  findWeekByDate,
  getEntry,
  listEdits,
  listEntries,
  undoEdit,
  updateEntry,
} from "./store";

// JSON 接口。网页后台、命令行脚本和 Claude 都通过它改内容。
export const api = new Hono<AppEnv>();

api.onError((err, c) => {
  if (err instanceof StoreError) return c.json({ error: err.message }, err.status);
  if (err instanceof z.ZodError) {
    const msg = err.issues.map((i) => (i.path.length ? i.path.join(".") + "：" : "") + i.message).join("；");
    return c.json({ error: msg }, 400);
  }
  console.error(err);
  return c.json({ error: "服务器出错了，请稍后再试" }, 500);
});

// 改数据的请求必须是 JSON。跨站页面没法不经预检就发 JSON，这样可以挡住借用登录状态的伪造请求。
async function readJson(c: Context<AppEnv>): Promise<unknown> {
  if (!c.req.header("content-type")?.includes("application/json")) {
    throw new StoreError(400, "请求要用 JSON 格式（Content-Type: application/json）");
  }
  try {
    return await c.req.json();
  } catch {
    throw new StoreError(400, "请求内容不是合法的 JSON");
  }
}

function parseId(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new StoreError(400, "修改记录编号不对");
  return n;
}

api.get("/health", (c) => c.json({ ok: true, authed: c.get("authed") }));

api.get("/entries", async (c) => {
  const kind = c.req.query("kind");
  if (kind !== undefined && !isKind(kind)) throw new StoreError(400, `不认识的类型：${kind}`);
  const entries = await listEntries(c.env.DB, {
    kind,
    parentId: c.req.query("parent") || undefined,
    includePrivate: c.get("authed"),
    limit: Number(c.req.query("limit")) || undefined,
  });
  return c.json({ entries });
});

api.get("/entries/:id", async (c) => {
  const entry = await getEntry(c.env.DB, c.req.param("id"), c.get("authed"));
  if (!entry) throw new StoreError(404, "找不到这条内容");
  return c.json({ entry });
});

// 本周：按北京时间找日期所在的那一周，连同任务和周记一起返回。
api.get("/week/current", async (c) => {
  const date = c.req.query("date") ?? todayInShanghai();
  const authed = c.get("authed");
  const week = await findWeekByDate(c.env.DB, date, authed);
  if (!week) return c.json({ date, week: null, tasks: [], journal: null });
  const tasks = await listEntries(c.env.DB, { kind: "task", parentId: week.id, includePrivate: authed });
  const [journal] = await listEntries(c.env.DB, { kind: "journal", parentId: week.id, includePrivate: authed });
  return c.json({ date, week, tasks, journal: journal ?? null });
});

api.post("/entries", requireAuth, async (c) => {
  const result = await createEntry(c.env.DB, (await readJson(c)) as never, c.get("actor"));
  return c.json(result, 201);
});

api.patch("/entries/:id", requireAuth, async (c) => {
  const result = await updateEntry(c.env.DB, c.req.param("id"), (await readJson(c)) as never, c.get("actor"));
  return c.json(result);
});

api.delete("/entries/:id", requireAuth, async (c) => {
  const v = c.req.query("version");
  const result = await deleteEntry(c.env.DB, c.req.param("id"), c.get("actor"), v ? Number(v) : undefined);
  return c.json(result);
});

api.get("/edits", requireAuth, async (c) => {
  const edits = await listEdits(c.env.DB, {
    limit: Number(c.req.query("limit")) || undefined,
    entryId: c.req.query("entry") || undefined,
  });
  return c.json({ edits });
});

api.post("/edits/:id/undo", requireAuth, async (c) => {
  const result = await undoEdit(c.env.DB, parseId(c.req.param("id")), c.get("actor"));
  return c.json(result);
});

api.get("/feed", requireAuth, async (c) => {
  const items = await listFeed(c.env.DB, Math.min(Number(c.req.query("limit")) || 20, 50));
  return c.json({ items });
});

api.post("/feed/refresh", requireAuth, async (c) => {
  try {
    return c.json(await refreshAihot(c.env.DB));
  } catch (err) {
    return c.json({ error: `拉取 AIHOT 失败：${(err as Error).message}` }, 502);
  }
});

api.notFound((c) => c.json({ error: "没有这个接口" }, 404));
