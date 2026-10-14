# 霜

用户（研一）的个人空间「霜」：首先给自己用，公开只是顺带。用 React + Vite 做成静态网站，内容是仓库里的文件，部署在 Cloudflare 上，只托管静态文件。用户用中文交流。

统一的说法见 `CONTEXT.md`，重要的决定见 `docs/adr/`。

## 改网站内容

用户在对话里让你改内容（勾任务、改书架、加研究问题、排下一个四周……）时，按下面的步骤做：

1. **改文件**：内容都在 `content/`，格式见 `content/README.md`。
2. **检查**：先跑 `npm run check:content`，再跑 `npm test`，都通过才继续。
3. **提交**：只提交和这次改动相关的文件，提交信息写清楚改了什么。
4. **上线**：运行 `npm run deploy`，它会先构建再部署到 Cloudflare。这台电脑连 Cloudflare 经常超时，失败了就重试。
5. **报告**：把提交编号告诉用户。要撤销时用 `git revert` 再部署一次。

几条规矩：

- **私密内容**：周记、草稿、还不想公开的研究问题，放在仓库根目录的 `private/`。这个文件夹被 Git 忽略，永远不要提交，也不要挪进 `content/`，除非用户明确说可以公开。
- **保密协议**：用户的项目有保密协议，不要把项目数据、图纸、内部代码细节或合作单位名称写进 `content/`。仓库是公开的。
- **AIHOT**：AIHOT 的内容不放进网站，它的条款不允许公开转载。

## 开发

- **工具位置**：Node.js 在 `E:\Program Files\nodejs`，GitHub 命令行 gh 在 `E:\Program Files\GitHub CLI`。新开的终端找不到它们时，先把目录加进 PATH。gh 的登录（`gh auth login`）由用户自己做。
- **常用命令**：
  - `npm run dev`：本地预览，地址是 http://localhost:5173。
  - `npm test`：跑测试。
  - `npm run typecheck`：类型检查。
  - `npm run build`：构建，产物放在 `dist/`。
  - `npm run preview`：先构建，再用 wrangler 按线上的方式在本地跑。
- **目录**：
  - `web/src/`：页面（React）。
  - `web/content/`：内容的读取、格式检查和 Vite 插件。
  - `content/`：公开内容。
  - `docs/`：文档。
- **内容怎么到页面上**：构建时 Vite 插件读出 `content/`、检查格式，作为 `virtual:content` 交给页面；格式不对，构建就失败。页面代码只能用 `import type` 引用 `web/content/schema.ts` 和 `load.ts`，不能把 zod 打包进页面（有测试守着）。页面也要用的取值放在 `web/content/constants.ts`。
- **外观**：方格笔记本，只做浅色。
  - 颜色都是 `web/src/styles.css` 顶部的变量，组件里不直接写颜色。
  - 手写字体在页面显示之后异步加载，加载不了就退回系统楷体。
  - 单列网格要写 `minmax(0, 1fr)`，否则长标题会把页面撑宽。
  - 设计参考见 `docs/design-references.md`。
- **响应头和跳转**：安全响应头和缓存规则在 `web/public/_headers`，旧地址的跳转在 `web/public/_redirects`。
- **测试**：用 vitest 在 node 环境里把页面渲染成字符串再断言。内容格式和"今天是哪一周"的计算都有单元测试。
- **包体积**：页面要等 JavaScript 下载完才显示（ADR 0002），加依赖前先想想包会不会变大。

## 密钥

- 新站不需要任何密钥。
- `.dev.vars`、`.env.local` 是旧站留下的，已被 Git 忽略。里面的值不要写进代码、文档或对话。
- 部署用的是 wrangler 的登录状态。
- Cloudflare 上还留着旧站的东西，新站都不用。要不要删由用户决定：
  - 旧密钥：API_TOKEN、SESSION_SECRET、ADMIN_PASSWORD；
  - 旧数据库：D1 `zhishitupu-site`。

## Agent skills

### Issue tracker

issue 记在本仓库的 GitHub Issues，用 `gh` 命令行操作。仓库是公开的，issue 也公开。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个分类标签用中文名：待分类、待补充、交给智能体、需要人工、不做。见 `docs/agents/triage-labels.md`。

### Domain docs

单一布局：根目录一个 `CONTEXT.md`，决策记录放在 `docs/adr/`。见 `docs/agents/domain.md`。
