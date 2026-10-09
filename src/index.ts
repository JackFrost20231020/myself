import { app } from "./app";
import type { Bindings } from "./env";
import { refreshAihot } from "./feed";

export default {
  fetch: app.fetch,
  // wrangler.jsonc 里的定时任务：每天拉一次 AIHOT 精选
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      refreshAihot(env.DB)
        .then((r) => console.log(`AIHOT：保存了 ${r.stored} 条`))
        .catch((err) => console.error("AIHOT 拉取失败", err)),
    );
  },
} satisfies ExportedHandler<Bindings>;
