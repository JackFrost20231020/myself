// 生成初始数据 seed/seed.sql：主页信息、前四周计划、书架上的 8 篇论文。
// 用 INSERT OR IGNORE，重复执行不会覆盖你后来改过的内容。
import { mkdirSync, writeFileSync } from "node:fs";

const now = new Date().toISOString();
const rows = [];

function add(entry) {
  rows.push({
    parentId: null,
    body: "",
    data: {},
    visibility: "public",
    ...entry,
  });
}

add({
  id: "profile",
  kind: "profile",
  title: "我的学习主页",
  body: "学习计划、论文笔记、研究问题和开发日志都在这里更新。\n方向：知识图谱 × 大模型智能体。",
  data: { links: [] },
  sort: 0,
});

const weeks = [
  {
    id: "w0",
    title: "准备周",
    start: "2026-10-08",
    end: "2026-10-11",
    tasks: [
      ["在 PaperDance 用一句话写下研究兴趣，然后刷 10 分钟", false],
      ["安装 Matt Pocock 的 skills", true],
      ["新建一个学习文件夹，在里面运行 /teach，开始学 Neo4j 和 Cypher", false],
      ["向组里要一份图谱导入文件的样例，问清现有代码在哪", false],
    ],
  },
  {
    id: "w1",
    title: "Neo4j 入门",
    start: "2026-10-12",
    end: "2026-10-18",
    tasks: [
      ["/teach 两节课：属性图模型；Cypher 的增删改查", false],
      ["在本地装好 Neo4j，把样例文件导进去，只导 10 个节点也算", false],
      ["精读组里的 KA-RAG，弄清现有系统怎么用图谱", false],
    ],
  },
  {
    id: "w2",
    title: "想清楚任务 1",
    start: "2026-10-19",
    end: "2026-10-25",
    tasks: [
      ["写一页任务 1 设计草稿：节点用什么做唯一 ID、导入批次怎么记、审计表有哪些字段", false],
      ["用 /grill-me 让 Claude 追问这份草稿，问到每个问题都有答案；改好后给组里看", false],
      ["/teach 一节：MERGE 和 CREATE 的区别、事务、唯一约束", false],
      ["精读 ReAct", false],
    ],
  },
  {
    id: "w3",
    title: "上传与导入",
    start: "2026-10-26",
    end: "2026-11-01",
    tasks: [
      ["实现浏览器上传 → 写入 Neo4j，先不做审计", false],
      ["用 /tdd 给导入函数写 3 个测试：重复导入不产生重复节点、坏文件给出明确报错、空文件不让程序崩溃", false],
      ["精读 RAG 综述的前三节", false],
    ],
  },
  {
    id: "w4",
    title: "审计 + 第一次月度复盘",
    start: "2026-11-02",
    end: "2026-11-08",
    tasks: [
      ["每次导入写一条审计记录：谁、什么时候、哪个文件、导入了多少节点和边", false],
      ["在组会上或找师兄师姐，用 5 分钟讲清 KA-RAG 或 ReAct", false],
      ["精读大模型与知识图谱路线图，只看框架图和前两节", false],
      ["月度复盘：翻一遍周记和 /teach 的学习记录，让 Claude 排下一个四周", false],
    ],
  },
];

weeks.forEach((w, i) => {
  add({ id: w.id, kind: "week", title: w.title, data: { start: w.start, end: w.end }, sort: i });
  w.tasks.forEach(([title, done], j) => {
    add({ id: `${w.id}-${j + 1}`, kind: "task", parentId: w.id, title, data: { done }, sort: j + 1 });
  });
  add({ id: `${w.id}-journal`, kind: "journal", parentId: w.id, title: "", visibility: "private", sort: 1 });
});

const papers = [
  ["p-karag", "KA-RAG: Integrating Knowledge Graphs and Agentic Retrieval-Augmented Generation for an Intelligent Educational Question-Answering Model", null, "Applied Sciences 2025 · 组内工作", "第 1 周"],
  ["p-react", "ReAct: Synergizing Reasoning and Acting in Language Models", "https://arxiv.org/abs/2210.03629", "ICLR 2023", "第 2 周"],
  ["p-rag-survey", "Retrieval-Augmented Generation for Large Language Models: A Survey", "https://arxiv.org/abs/2312.10997", "arXiv 2023", "第 3 周"],
  ["p-llm-kg", "Unifying Large Language Models and Knowledge Graphs: A Roadmap", "https://arxiv.org/abs/2306.08302", "IEEE TKDE 2024", "第 4 周"],
  ["p-effective-agents", "Building Effective Agents", "https://www.anthropic.com/engineering/building-effective-agents", "Anthropic 2024", "第 5 周"],
  ["p-graphrag", "From Local to Global: A Graph RAG Approach to Query-Focused Summarization", "https://arxiv.org/abs/2404.16130", "Microsoft 2024", "第 6 周"],
  ["p-text2cypher", "Text2Cypher: Bridging Natural Language and Graph Databases", "https://arxiv.org/abs/2412.10064", "Neo4j 2024", "第 7 周"],
  ["p-pid-reasoning", "Grounded and Faithful P&ID Reasoning: Constraining Vision-Language Models with Recovered Evidence Graphs", "https://arxiv.org/abs/2609.05880", "arXiv 2026", "第 8 周"],
];
papers.forEach(([id, title, url, venue, week], i) => {
  const data = { status: "shelf", venue, week };
  if (url) data.url = url;
  add({ id, kind: "paper", title, data, sort: i + 1 });
});

add({
  id: "q-first",
  kind: "question",
  title: "自动解析出的图谱里，哪些连接最值得先让人检查？",
  body: "想法：把模型置信度、拓扑规则（断点、孤立节点）和大模型判断合在一起打分。",
  data: { status: "open" },
  visibility: "private",
  sort: 1,
});

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sql = rows
  .map(
    (r) =>
      "INSERT OR IGNORE INTO entries (id, kind, parent_id, title, body, data, visibility, sort, version, created_at, updated_at) VALUES (" +
      [r.id, r.kind, r.parentId, r.title, r.body, JSON.stringify(r.data), r.visibility, r.sort, 1, now, now].map(q).join(", ") +
      ");",
  )
  .join("\n");

mkdirSync("seed", { recursive: true });
writeFileSync("seed/seed.sql", sql + "\n");
console.log(`seed/seed.sql：${rows.length} 条初始内容`);
