import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { api } from "./api";
import { identify } from "./auth";
import type { AppEnv } from "./env";
import { session } from "./session";
import { admin } from "./views/admin";
import { pages, renderNotFound } from "./views/public";

export const app = new Hono<AppEnv>();

// 安全响应头：只允许加载本站的脚本和样式，禁止被别的网站用 iframe 嵌入。
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);
app.use("*", identify);
// 表单类请求只接受来自本站的提交
app.use("*", csrf());
// 页面每次都从数据库读最新内容，不让浏览器和 CDN 缓存
app.use("*", async (c, next) => {
  await next();
  if (c.res.headers.get("content-type")?.includes("text/html")) c.res.headers.set("cache-control", "no-store");
});

app.route("/api", api);
app.route("/admin", session);
app.route("/admin", admin);
app.route("/", pages);

app.notFound((c) =>
  c.req.path.startsWith("/api/") ? c.json({ error: "找不到这个接口" }, 404) : renderNotFound(c),
);

app.onError((err, c) => {
  // 中间件主动拒绝的请求（比如 CSRF 检查不通过）保留原来的状态码
  if (err instanceof HTTPException) {
    const message = err.status === 403 ? "请求来源不对，已拒绝" : err.message || "请求有误";
    return c.req.path.startsWith("/api/") ? c.json({ error: message }, err.status) : c.text(message, err.status);
  }
  console.error(err);
  return c.html('<!DOCTYPE html><meta charset="utf-8"><title>出错了</title><p>页面出错了，请稍后再试。<a href="/">回主页</a></p>', 500);
});
