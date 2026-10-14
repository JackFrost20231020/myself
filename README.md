# 霜

JackFrost 的方格本：这周在做什么、读了什么、想到了什么。主要写给自己看。

- **首页**：一本摊开的方格笔记本。左页是这一周的计划，右页是关于我和书架。
- **栏目**：
  - 在做什么：整个计划和研究问题。
  - 书架：在读、想读、读完的论文。
  - 关于我。
- **内容**：全部是仓库里的文件（`content/`）。改了文件、构建、部署，网站就跟着变。修改历史就是 Git 历史。

技术栈：[React](https://react.dev) + [Vite](https://vite.dev)，构建成静态文件，用 [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) 托管。

## 本地运行

需要 Node.js 22.18 以上。

```bash
npm install
npm run dev            # 打开 http://localhost:5173
```

- `npm test`：跑测试。
- `npm run typecheck`：类型检查。
- `npm run check:content`：检查内容文件的格式。

## 改内容

内容在 `content/`，每个文件的格式见 [content/README.md](content/README.md)。私密内容（周记、草稿）放在 `private/`，这个文件夹不提交。

## 部署

```bash
npx wrangler login     # 只需要第一次
npm run deploy         # 构建并部署到 https://zhishitupu-site.zhishitupu-site.workers.dev
```

## 代码结构

```
content/            公开内容：关于我、计划、书架、研究问题
web/
  content/          读取并检查内容文件，Vite 插件把内容交给页面
  src/              页面（React）
  public/           图标、响应头（_headers）、旧地址跳转（_redirects）
docs/               决策记录（adr/）、体检报告（reviews/）、设计参考
```

## 以前的版本

旧版是一个带后台、数据库和修改历史的 Hono 网站。它的代码还留在 Git 历史里（提交 c40319d 之前），换成现在的样子的原因见 [docs/adr/0001-content-as-files.md](docs/adr/0001-content-as-files.md)。Cloudflare 上的旧数据库 `zhishitupu-site` 没有删。
