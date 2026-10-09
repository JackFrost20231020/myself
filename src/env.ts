// Worker 运行时能拿到的绑定和密钥。密钥在本地放 .dev.vars，线上用 `wrangler secret put` 设置。
export type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  API_TOKEN: string;
  SESSION_SECRET: string;
};

// 谁做的改动，会写进修改历史。
export type Actor = "web" | "claude" | "cli" | "cron" | "seed";

export type Variables = {
  authed: boolean;
  actor: Actor;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
