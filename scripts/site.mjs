#!/usr/bin/env node
// 用命令行改网站内容。Claude 在对话里改网站，调用的就是这个脚本。
// 用法见 `node scripts/site.mjs help`。
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const devVars = loadEnvFile(".dev.vars");
const envLocal = loadEnvFile(".env.local");
const SITE_URL = (process.env.SITE_URL || envLocal.SITE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SITE_URL);
const TOKEN = process.env.SITE_TOKEN || envLocal.SITE_TOKEN || (isLocal ? devVars.API_TOKEN : undefined);
const ACTOR = process.env.SITE_ACTOR || "claude";

const HELP = `用法：node scripts/site.mjs <命令> [参数]

查看
  week [YYYY-MM-DD]          本周（或指定日期所在那周）的任务和周记
  list <类型> [--parent id]  列出内容。类型：week task journal paper question devlog learn profile
  show <id>                  看一条内容的全部字段
  history [--limit 20] [--entry id]   修改历史
  feed                       后台的 AI 资讯（AIHOT）

修改（每次都会记进修改历史）
  add <类型> <标题> [--parent 周id] [--body 文本] [--public|--private] [--id 自定义id]
                    [--url 链接] [--venue 出处] [--status 状态] [--week 第几周]
                    [--date YYYY-MM-DD] [--topic 主题] [--start 日期] [--end 日期] [--data JSON]
  set <id> [--title 标题] [--body 文本] [--public|--private] [--parent 周id] [以及 add 里的 data 参数]
  done <id> / undone <id>    勾选或取消勾选任务
  rm <id>                    删除
  undo <修改记录编号>        撤销一次修改
  feed refresh               立即拉取一次 AIHOT

连接哪个网站：默认 ${SITE_URL}。线上地址和令牌写在 .env.local（参考 .env.example）。`;

const DATA_FLAGS = ["url", "venue", "status", "week", "date", "topic", "start", "end"];

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--public" || arg === "--private") flags.visibility = arg.slice(2);
    else if (arg.startsWith("--")) flags[arg.slice(2)] = argv[++i] ?? "";
    else positional.push(arg);
  }
  return { positional, flags };
}

function dataFromFlags(flags) {
  const data = flags.data ? JSON.parse(flags.data) : {};
  for (const key of DATA_FLAGS) if (flags[key] !== undefined) data[key] = flags[key];
  return data;
}

// 这些错误发生在请求发出之前，重试不会重复执行修改。
const NOT_SENT = new Set(["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);

async function call(method, path, body) {
  const headers = { accept: "application/json", "x-actor": ACTOR };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(SITE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      break;
    } catch (err) {
      const code = err.cause?.code ?? err.message;
      const retryable = NOT_SENT.has(code) || method === "GET";
      if (!retryable || attempt >= 3) {
        throw new Error(`连不上 ${SITE_URL}（${code}）。网络慢可以再试一次；本地开发要先运行 npm run dev。`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `请求失败（${res.status}）`);
  return json;
}

const vis = (e) => (e.visibility === "public" ? "公开" : "私密");
const line = (e) => `${e.id} · ${e.title || "（无标题）"}${e.data?.status ? ` · ${e.data.status}` : ""} · ${vis(e)}`;

function savedMessage(result, verb = "已保存") {
  return result.editId ? `${verb}（修改记录 #${result.editId}，撤销用：undo ${result.editId}）` : "内容没有变化，没有记录修改";
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case "week": {
      const date = positional[0] ? `?date=${encodeURIComponent(positional[0])}` : "";
      const r = await call("GET", `/api/week/current${date}`);
      if (!r.week) return console.log(`${r.date} 不在任何一周里。`);
      const w = r.week;
      console.log(`${w.id} · ${w.title} · ${w.data.start} → ${w.data.end} · ${vis(w)}`);
      for (const t of r.tasks) console.log(`  [${t.data.done ? "x" : " "}] ${t.id} ${t.title}${t.visibility === "private" ? "（私密）" : ""}`);
      if (r.journal) console.log(`周记（${r.journal.id}，${vis(r.journal)}）：${r.journal.body || "（空）"}`);
      return;
    }
    case "list": {
      const [kind] = positional;
      if (!kind) throw new Error("要写类型，例如 list paper");
      const parent = flags.parent ? `&parent=${encodeURIComponent(flags.parent)}` : "";
      const r = await call("GET", `/api/entries?kind=${encodeURIComponent(kind)}${parent}`);
      if (!r.entries.length) return console.log("（没有内容）");
      for (const e of r.entries) console.log(line(e));
      return;
    }
    case "show": {
      const r = await call("GET", `/api/entries/${encodeURIComponent(positional[0] ?? "")}`);
      return console.log(JSON.stringify(r.entry, null, 2));
    }
    case "add": {
      const [kind, ...titleParts] = positional;
      if (!kind) throw new Error("要写类型和标题，例如 add question \"图谱纠错怎么评测？\"");
      const body = { kind, title: titleParts.join(" "), data: dataFromFlags(flags) };
      if (flags.parent) body.parentId = flags.parent;
      if (flags.body !== undefined) body.body = flags.body;
      if (flags.visibility) body.visibility = flags.visibility;
      if (flags.id) body.id = flags.id;
      const r = await call("POST", "/api/entries", body);
      return console.log(`${line(r.entry)}\n${savedMessage(r, "已新建")}`);
    }
    case "set": {
      const [id] = positional;
      if (!id) throw new Error("要写 id，例如 set w1-2 --title 新标题");
      const body = {};
      if (flags.title !== undefined) body.title = flags.title;
      if (flags.body !== undefined) body.body = flags.body;
      if (flags.visibility) body.visibility = flags.visibility;
      if (flags.parent !== undefined) body.parentId = flags.parent;
      const data = dataFromFlags(flags);
      if (Object.keys(data).length) body.data = data;
      const r = await call("PATCH", `/api/entries/${encodeURIComponent(id)}`, body);
      return console.log(`${line(r.entry)}\n${savedMessage(r)}`);
    }
    case "done":
    case "undone": {
      const r = await call("PATCH", `/api/entries/${encodeURIComponent(positional[0] ?? "")}`, { data: { done: command === "done" } });
      return console.log(`${command === "done" ? "已勾选" : "已取消勾选"}：${r.entry.title}\n${savedMessage(r)}`);
    }
    case "rm": {
      const r = await call("DELETE", `/api/entries/${encodeURIComponent(positional[0] ?? "")}`);
      return console.log(savedMessage(r, "已删除"));
    }
    case "history": {
      const params = new URLSearchParams();
      if (flags.limit) params.set("limit", flags.limit);
      if (flags.entry) params.set("entry", flags.entry);
      const r = await call("GET", `/api/edits?${params}`);
      for (const e of r.edits) {
        const snap = e.after ?? e.before;
        const op = e.undoOf ? `撤销#${e.undoOf}` : { create: "新建", update: "修改", delete: "删除" }[e.op];
        const beijing = new Date(new Date(e.at).getTime() + 8 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
        console.log(`#${e.id} ${beijing} ${e.actor} ${op} ${e.entryId} ${snap?.title ?? ""}${e.undoneBy ? "（已撤销）" : ""}`);
      }
      return;
    }
    case "undo": {
      const r = await call("POST", `/api/edits/${encodeURIComponent(positional[0] ?? "")}/undo`, {});
      return console.log(`已撤销，内容现在是：${r.entry ? line(r.entry) : "（已删除）"}（这次撤销记为 #${r.editId}）`);
    }
    case "feed": {
      if (positional[0] === "refresh") {
        const r = await call("POST", "/api/feed/refresh", {});
        return console.log(`拉取了 ${r.stored} 条`);
      }
      const r = await call("GET", "/api/feed");
      for (const it of r.items) console.log(`· ${it.title}（${it.sourceName ?? "AIHOT"}）${it.url}`);
      return;
    }
    default:
      console.log(HELP);
  }
}

main().catch((err) => {
  console.error("出错了：" + err.message);
  process.exit(1);
});
