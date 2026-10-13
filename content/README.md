# 内容文件

「霜」的全部公开内容都在这个文件夹里。改了这里的文件、提交并发布，网站就会跟着变。

- **检查格式**：运行 `npm run check:content`。格式不对时会逐条列出是哪个文件、哪个字段。构建时也会做同样的检查，有问题就构建失败。
- **字段**：字段名用英文，值用中文。多写或拼错字段名都会报错。
- **私密内容**：周记、草稿、私密的研究问题放在仓库根目录的 `private/` 里。这个文件夹被 Git 忽略，永远不提交（见 `docs/adr/0001-content-as-files.md`）。
- **保密**：不要把实验室项目的数据、图纸、内部代码细节或合作单位名称写进这里。这里的每个文件都是公开的。

说法统一按 `CONTEXT.md` 来，比如「书架」指整份论文清单，「想读」是其中一种状态。

## about.md：关于我

开头用 `---` 包起来的是基本信息，后面是一小段 Markdown 正文。

```markdown
---
name: JackFrost          # 网名
facts:                   # 1–6 条短信息，按顺序显示
  - label: 身份
    value: 研一
  - label: 方向
    value: 知识图谱 × 大模型智能体
  - label: 近况
    value: 在学 Neo4j 和 Cypher
---
这里是我的方格本……
```

## plan.yaml：计划

按周排，每次只细排接下来四周。

```yaml
weeks:
  - id: w1                 # 周的 id：w + 数字
    title: "Neo4j 入门"
    start: "2026-10-12"    # 日期加引号，格式 YYYY-MM-DD
    end: "2026-10-18"
    tasks:
      - id: w1-1           # 任务 id：所在周的 id + - + 数字
        title: "……"
        done: false        # 做完改成 true
```

规则：
- 各周按时间先后排，日期不能重叠。
- 所有 id 都不能重复。

## shelf.yaml：书架

```yaml
papers:
  - id: p-react
    title: "ReAct: Synergizing Reasoning and Acting in Language Models"
    status: 想读            # 在读 / 想读 / 读完
    venue: "ICLR 2023"     # 可选：出处
    url: "https://arxiv.org/abs/2210.03629"   # 可选：只能是 http 或 https
    week: "第 2 周"         # 可选：打算第几周读，只是提醒
    note: "……"             # 可选：一两句话的备注
```

## questions.yaml：研究问题

只放可以公开的问题。

```yaml
questions:
  - id: q-graph-eval
    title: "图谱纠错怎么评测？"
    status: 待想            # 想做 / 待想 / 已和导师讨论 / 放弃
    note: "……"             # 可选
```

没有问题时写 `questions: []`。
