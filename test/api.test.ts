import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import type { Bindings } from "../src/env";
import { createEntry } from "../src/store";
import { clearDb, setupDb } from "./helpers";

let db: D1Database;
let dispose: () => Promise<void>;
let env: Bindings;

const TOKEN = "test-api-token-123456";
const PASSWORD = "test-admin-password";

beforeAll(async () => {
  ({ db, dispose } = await setupDb());
  env = { DB: db, ADMIN_PASSWORD: PASSWORD, API_TOKEN: TOKEN, SESSION_SECRET: "test-session-secret-abcdef" };
});
afterAll(async () => {
  await dispose();
});
beforeEach(async () => {
  await clearDb(db);
  await createEntry(db, { kind: "week", id: "w1", title: "Neo4j 入门", data: { start: "2026-10-12", end: "2026-10-18" } }, "seed");
  await createEntry(db, { kind: "task", id: "w1-1", parentId: "w1", title: "公开的任务" }, "seed");
  await createEntry(db, { kind: "journal", id: "w1-journal", parentId: "w1", title: "", body: "私密的周记内容" }, "seed");
});

const json = (body: unknown, extra: Record<string, string> = {}) => ({
  headers: { "content-type": "application/json", ...extra },
  body: JSON.stringify(body),
});
const bearer = { authorization: `Bearer ${TOKEN}` };

async function login(password = PASSWORD) {
  return app.request(
    "/admin/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost" },
      body: new URLSearchParams({ password }).toString(),
    },
    env,
  );
}

describe("接口权限", () => {
  it("没登录只能看到公开内容", async () => {
    const res = await app.request("/api/entries", {}, env);
    const { entries } = (await res.json()) as { entries: { id: string }[] };
    expect(entries.map((e) => e.id).sort()).toEqual(["w1", "w1-1"]);
  });

  it("没登录不能改内容", async () => {
    const res = await app.request("/api/entries", { method: "POST", ...json({ kind: "question", title: "x" }) }, env);
    expect(res.status).toBe(401);
  });

  it("带令牌可以新建，修改历史记下来源", async () => {
    const res = await app.request(
      "/api/entries",
      { method: "POST", ...json({ kind: "question", title: "图谱纠错怎么评测？" }, { ...bearer, "x-actor": "claude" }) },
      env,
    );
    expect(res.status).toBe(201);
    const edits = await app.request("/api/edits", { headers: bearer }, env);
    const { edits: list } = (await edits.json()) as { edits: { actor: string; op: string }[] };
    expect(list[0]).toMatchObject({ actor: "claude", op: "create" });
  });

  it("令牌不对就当没登录", async () => {
    const res = await app.request("/api/entries", { method: "POST", ...json({ kind: "question", title: "x" }, { authorization: "Bearer wrong" }) }, env);
    expect(res.status).toBe(401);
  });

  it("版本过期的修改返回 409 和中文提示", async () => {
    await app.request("/api/entries/w1-1", { method: "PATCH", ...json({ title: "第一次" }, bearer) }, env);
    const res = await app.request("/api/entries/w1-1", { method: "PATCH", ...json({ title: "第二次", version: 1 }, bearer) }, env);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("别处改过");
  });

  it("改数据的请求必须是 JSON", async () => {
    const res = await app.request("/api/entries/w1-1", { method: "PATCH", headers: { ...bearer, "content-type": "application/xml" }, body: "<title>x</title>" }, env);
    expect(res.status).toBe(400);
    // 表单类格式会先被 CSRF 检查拦下
    const form = await app.request("/api/entries/w1-1", { method: "PATCH", headers: { ...bearer, "content-type": "text/plain" }, body: "title=x" }, env);
    expect(form.status).toBe(403);
  });

  it("可以通过接口撤销", async () => {
    const patch = await app.request("/api/entries/w1-1", { method: "PATCH", ...json({ title: "改错了" }, bearer) }, env);
    const { editId } = (await patch.json()) as { editId: number };
    const undo = await app.request(`/api/edits/${editId}/undo`, { method: "POST", ...json({}, bearer) }, env);
    expect(undo.status).toBe(200);
    const after = await app.request("/api/entries/w1-1", {}, env);
    expect(((await after.json()) as { entry: { title: string } }).entry.title).toBe("公开的任务");
  });
});

describe("后台登录", () => {
  it("密码错误会回到登录页", async () => {
    const res = await login("wrong-password");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/login?error=wrong");
  });

  it("密码正确拿到登录 cookie，之后能看到私密内容", async () => {
    const res = await login();
    expect(res.headers.get("location")).toBe("/admin");
    const cookie = res.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toMatch(/^sid=/);
    const list = await app.request("/api/entries?kind=journal", { headers: { cookie: cookie! } }, env);
    const { entries } = (await list.json()) as { entries: { body: string }[] };
    expect(entries[0]?.body).toBe("私密的周记内容");
  });

  it("连续失败 10 次后暂时锁住，正确密码也进不去", async () => {
    for (let i = 0; i < 10; i++) await login("wrong-password");
    const res = await login();
    expect(res.headers.get("location")).toBe("/admin/login?error=locked");
  });

  it("其他网站提交的登录表单会被拒绝", async () => {
    const res = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example" },
        body: new URLSearchParams({ password: PASSWORD }).toString(),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("没登录访问后台会跳到登录页", async () => {
    const res = await app.request("/admin", {}, env);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/login");
  });
});

describe("公开页面", () => {
  it("计划页显示公开任务，不显示私密周记", async () => {
    const res = await app.request("/plan", {}, env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("公开的任务");
    expect(html).not.toContain("私密的周记内容");
  });

  it("页面不允许被缓存，并带安全响应头", async () => {
    const res = await app.request("/", {}, env);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("没有公开内容的栏目不放进导航", async () => {
    const navOf = async () => {
      const html = await (await app.request("/", {}, env)).text();
      return /<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    };
    const before = await navOf();
    expect(before).toContain('href="/plan"');
    expect(before).not.toContain('href="/questions"');
    expect(before).not.toContain('href="/log"');

    await createEntry(db, { kind: "question", title: "公开的问题", visibility: "public" }, "seed");
    expect(await navOf()).toContain('href="/questions"');
  });

  it("空栏目直接打开时仍能访问，导航里标出当前页", async () => {
    const res = await app.request("/questions", {}, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('href="/questions" aria-current="page"');
  });

  it("找不到的页面返回 404，页面上有回主页的链接；接口返回 JSON", async () => {
    const page = await app.request("/no-such-page", {}, env);
    expect(page.status).toBe(404);
    const html = await page.text();
    expect(html).toContain("找不到这个页面");
    expect(html).toContain('href="/"');

    const apiRes = await app.request("/api/no-such-thing", {}, env);
    expect(apiRes.status).toBe(404);
    expect(((await apiRes.json()) as { error: string }).error).toBeTruthy();
  });

  it("登录后的后台概览能打开", async () => {
    const cookie = (await login()).headers.get("set-cookie")?.split(";")[0];
    const res = await app.request("/admin", { headers: { cookie: cookie! } }, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("修改历史");
  });
});
