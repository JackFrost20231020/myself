import { Hono } from "hono";
import { checkPassword, endSession, startSession } from "./auth";
import type { AppEnv } from "./env";

// 后台登录和退出。登录页本身在 views/admin.tsx。
export const session = new Hono<AppEnv>();

session.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const password = typeof form.password === "string" ? form.password : "";
  const result = await checkPassword(c.env.DB, c.env.ADMIN_PASSWORD, password);
  if (result === "ok" && c.env.SESSION_SECRET) {
    await startSession(c);
    return c.redirect("/admin", 303);
  }
  const reason = result === "ok" ? "not-configured" : result;
  return c.redirect(`/admin/login?error=${reason}`, 303);
});

session.post("/logout", (c) => {
  endSession(c);
  return c.redirect("/", 303);
});
