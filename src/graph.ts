import { todayInShanghai } from "./dates";
import type { Entry } from "./store";

// 首页「学习图谱」的数据：节点是我、周、任务、论文、研究问题、日志、学习记录，边是它们之间的关系。
// 只用公开内容生成，生成后直接嵌进公开页面，所以这里会再过滤一次私密内容。

export type GraphNodeKind = "me" | "week" | "task" | "paper" | "question" | "devlog" | "learn";
export type GraphNodeState = "done" | "current" | "future" | "open" | "reading" | "shelf";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  title: string;
  href: string;
  state?: GraphNodeState;
};

// sequence：周和周之间的主干；contains：周里的任务；about：内容和它所属的周
export type GraphEdge = { source: string; target: string; kind: "sequence" | "contains" | "about" };

export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function weekNo(week: Entry, index: number): string {
  return /^w(\d+)$/.exec(week.id)?.[1] ?? String(index);
}

export function buildGraph(entries: Entry[], meLabel: string, today: string = todayInShanghai()): GraphData {
  const pub = entries.filter((e) => e.visibility === "public");
  const weeks = pub.filter((e) => e.kind === "week").sort((a, b) => a.sort - b.sort);
  const weekIds = new Set(weeks.map((w) => w.id));
  const nodes: GraphNode[] = [{ id: "me", kind: "me", label: meLabel, title: meLabel, href: "/" }];
  const edges: GraphEdge[] = [];

  const range = (w: Entry) => ({ start: String(w.data.start ?? ""), end: String(w.data.end ?? "") });
  weeks.forEach((w, i) => {
    const { start, end } = range(w);
    const state: GraphNodeState = today < start ? "future" : today > end ? "done" : "current";
    const n = weekNo(w, i);
    nodes.push({ id: w.id, kind: "week", label: `第 ${n} 周`, title: `第 ${n} 周 · ${w.title}`, href: `/plan#${w.id}`, state });
    const prev = weeks[i - 1];
    if (prev) edges.push({ source: prev.id, target: w.id, kind: "sequence" });
  });

  // 「我」连到本周；不在任何一周里时，连到最近开始的一周，再不行就连第一周
  const current =
    weeks.find((w) => range(w).start <= today && today <= range(w).end) ??
    [...weeks].reverse().find((w) => range(w).start <= today) ??
    weeks[0];
  if (current) edges.push({ source: "me", target: current.id, kind: "about" });

  const weekForDate = (date: string) => weeks.find((w) => range(w).start <= date && date <= range(w).end)?.id ?? null;
  const weekForLabel = (label: unknown) => {
    const m = /(\d+)/.exec(String(label ?? ""));
    const id = m ? `w${m[1]}` : "";
    return weekIds.has(id) ? id : null;
  };

  for (const e of pub) {
    if (e.kind === "task") {
      if (!e.parentId || !weekIds.has(e.parentId)) continue;
      nodes.push({
        id: e.id,
        kind: "task",
        label: truncate(e.title, 16),
        title: e.title,
        href: `/plan#${e.parentId}`,
        state: e.data.done === true ? "done" : "open",
      });
      edges.push({ source: e.parentId, target: e.id, kind: "contains" });
    } else if (e.kind === "paper") {
      const status = String(e.data.status ?? "shelf");
      nodes.push({
        id: e.id,
        kind: "paper",
        label: truncate(e.title, 22),
        title: e.title,
        href: `/papers#${e.id}`,
        state: status === "done" ? "done" : status === "reading" ? "reading" : "shelf",
      });
      edges.push({ source: weekForLabel(e.data.week) ?? "me", target: e.id, kind: "about" });
    } else if (e.kind === "question" || e.kind === "devlog" || e.kind === "learn") {
      const date = typeof e.data.date === "string" ? e.data.date : todayInShanghai(new Date(e.createdAt));
      const page = e.kind === "question" ? "questions" : e.kind === "devlog" ? "log" : "learn";
      nodes.push({ id: e.id, kind: e.kind, label: truncate(e.title, 18), title: e.title, href: `/${page}#${e.id}` });
      edges.push({ source: weekForDate(date) ?? "me", target: e.id, kind: "about" });
    }
  }
  return { nodes, edges };
}

// 嵌进 <script type="application/json"> 时，把 < 转义，避免内容里出现 </script> 提前结束标签。
export function graphJson(graph: GraphData): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
