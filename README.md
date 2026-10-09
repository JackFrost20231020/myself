# 我的学习主页

一个可以在线编辑的个人学习主页：学习计划、论文笔记、研究问题、开发日志和学习记录。

- **公开页**：访客能看到标为「公开」的内容。
- **后台**（`/admin`）：只有我能登录。在网页上直接改，改完立即生效。
- **修改历史**：每次新建、修改、删除都记下改动前后的完整内容，可以一键撤销；撤销本身也会记一条，撤销错了还能再撤回来。
- **让 Claude 改**：Claude 通过命令行工具 `scripts/site.mjs` 调接口改内容，改动同样进修改历史。
- **AI 资讯**：每天早上 8:30 自动从 [AIHOT](https://aihot.news) 拉过去 24 小时的精选，只在后台显示（AIHOT 的条款不允许未经授权公开转载）。

技术栈：[Cloudflare Workers](https://developers.cloudflare.com/workers/) + [D1](https://developers.cloudflare.com/d1/)（SQLite）+ [Hono](https://hono.dev)（服务端渲染 JSX），免费额度内运行。

## 本地运行

需要 Node.js 22 以上。

```bash
npm install
cp .dev.vars.example .dev.vars        # 填上本地用的密码和随机字符串
npm run db:migrate:local
npm run db:seed:local
npm run dev                           # 打开 http://127.0.0.1:8787
```

后台在 `/admin/login`，密码是 `.dev.vars` 里的 `ADMIN_PASSWORD`。

测试：`npm test`；类型检查：`npm run typecheck`。

## 部署到 Cloudflare

```bash
npx wrangler login                                  # 浏览器里登录 Cloudflare 账号
npx wrangler d1 create zhishitupu-site              # 把输出的 database_id 填进 wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote
npx wrangler secret put ADMIN_PASSWORD              # 后台密码，至少 12 位
npx wrangler secret put API_TOKEN                   # 给命令行和 Claude 用的令牌
npx wrangler secret put SESSION_SECRET              # 随机长字符串
npm run deploy                                      # 输出 https://zhishitupu-site.<子域>.workers.dev
```

`*.workers.dev` 这类免费域名在中国大陆可能打不开。以后要稳定访问，可以买一个域名接到 Cloudflare 上。

## 用命令行改内容

把 `.env.example` 复制成 `.env.local`，填上网站地址和 `API_TOKEN`，然后：

```bash
node scripts/site.mjs week                          # 本周任务和周记
node scripts/site.mjs done w1-2                     # 勾选任务
node scripts/site.mjs add question "图谱纠错怎么评测？"  # 新建研究问题（默认私密）
node scripts/site.mjs set p-react --status reading  # 把论文改成「在读」
node scripts/site.mjs history                       # 看修改历史
node scripts/site.mjs undo 12                       # 撤销第 12 次修改
node scripts/site.mjs help                          # 全部命令
```

## 代码结构

```
src/
  index.ts          Worker 入口：网页请求 + 每天的定时任务
  app.ts            路由和安全中间件
  store.ts          内容的增删改、修改历史和撤销（核心逻辑）
  kinds.ts          各种内容类型和它们的字段校验
  api.ts            JSON 接口（后台、命令行、Claude 都用它）
  auth.ts           登录、令牌、防暴力猜密码
  feed.ts           拉取 AIHOT
  markdown.ts       安全的 Markdown 渲染
  views/            公开页和后台页（Hono JSX）
public/             样式、后台交互脚本、图标
migrations/         数据库结构
scripts/            初始数据生成、命令行工具
test/               测试（用 wrangler 在本地起真实的 D1）
```

## 撤销是怎么实现的

每次改动在 `edits` 表里存一条记录：改动前的完整快照、改动后的完整快照、谁改的、什么时候。撤销时先检查这条内容现在是否还和「改动后」一致；一致就写回「改动前」，并把这次撤销也存成一条新记录。如果之后又被改过，就拒绝撤销，避免覆盖后来的改动。写内容和写记录在同一个数据库事务里完成。
