# 个人学习主页

用户（研一）的公开学习主页，内容是学习计划、论文笔记、研究问题、开发日志、学习记录。Cloudflare Workers + D1 + Hono，代码在本目录。用户用中文交流。

## 改网站内容：用命令行工具，不要直接写数据库

用户在对话里让你改网站内容（勾任务、加论文、写日志、排下一个四周等）时，用 `node scripts/site.mjs`，它调网站接口，每次改动都会进修改历史、可撤销。

- 先 `node scripts/site.mjs help` 看命令；`week` 看本周，`list <类型>` 看内容，`history` 看改动。
- 连哪个网站：`.env.local` 的 `SITE_URL` / `SITE_TOKEN`；没有就连本地 `http://127.0.0.1:8787`（需要先 `npm run dev`），令牌取 `.dev.vars` 的 `API_TOKEN`。
- 改完把命令输出里的修改记录编号告诉用户，方便撤销。
- 新建的论文、研究问题、开发日志、学习记录、周记默认私密；任务和周默认公开。只有用户明确说可以公开时才用 `--public`。
- 用户的项目有保密协议：不要把项目数据、图纸、内部代码细节、合作单位名称写进公开内容。

## 开发

- Node.js 在 `E:\Program Files\nodejs`；新开的终端如果找不到 node，先把这个目录加进 PATH。
- `npm run dev` 本地运行；`npm test` 测试（vitest + wrangler 的 getPlatformProxy，跑真实的本地 D1）；`npm run typecheck` 类型检查。
- 改了 `wrangler.jsonc` 后运行 `npx wrangler types` 重新生成 `worker-configuration.d.ts`。
- 数据库结构改动：在 `migrations/` 新增编号递增的 SQL 文件，不要改已有的迁移。
- 所有内容都在 `entries` 表，用 `kind` 区分；类型特有字段在 `data`（JSON），字段校验在 `src/kinds.ts`。
- 内容的增删改只能走 `src/store.ts` 的函数，它们负责写修改历史；不要绕过。
- 页面有内容安全策略（CSP）：不能写行内脚本和 `style` 属性，脚本放 `public/`，样式写进 `public/app.css`。
- AIHOT 的内容只能在后台显示，条款不允许未经授权公开转载。

## 密钥

`.dev.vars`、`.env.local` 已被 Git 忽略，里面的值不要写进代码、文档或对话。线上密钥用 `npx wrangler secret put`，由用户自己输入。
