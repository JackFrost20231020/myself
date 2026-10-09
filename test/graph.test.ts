import { describe, expect, it } from "vitest";
import { buildGraph, graphJson } from "../src/graph";
import type { Entry } from "../src/store";

let seq = 0;
function entry(partial: Partial<Entry> & Pick<Entry, "id" | "kind">): Entry {
  seq++;
  return {
    parentId: null,
    title: partial.id,
    body: "",
    data: {},
    visibility: "public",
    sort: seq,
    version: 1,
    createdAt: "2026-10-09T02:00:00.000Z",
    updatedAt: "2026-10-09T02:00:00.000Z",
    ...partial,
  };
}

const entries: Entry[] = [
  entry({ id: "w0", kind: "week", title: "准备周", data: { start: "2026-10-08", end: "2026-10-11" } }),
  entry({ id: "w1", kind: "week", title: "Neo4j 入门", data: { start: "2026-10-12", end: "2026-10-18" } }),
  entry({ id: "w2", kind: "week", title: "想清楚任务 1", data: { start: "2026-10-19", end: "2026-10-25" } }),
  entry({ id: "w0-1", kind: "task", parentId: "w0", title: "刷论文", data: { done: true } }),
  entry({ id: "w1-1", kind: "task", parentId: "w1", title: "装 Neo4j", data: { done: false } }),
  entry({ id: "p-react", kind: "paper", title: "ReAct", data: { week: "第 2 周", status: "reading" } }),
  entry({ id: "p-free", kind: "paper", title: "没排周的论文", data: {} }),
  entry({ id: "q1", kind: "question", title: "公开的问题", createdAt: "2026-10-13T03:00:00.000Z" }),
  entry({ id: "q-secret", kind: "question", title: "私密的问题", visibility: "private" }),
  entry({ id: "w0-journal", kind: "journal", parentId: "w0", title: "", body: "周记" }),
];

describe("学习图谱数据", () => {
  const graph = buildGraph(entries, "我", "2026-10-09");
  const ids = graph.nodes.map((n) => n.id);
  const has = (source: string, target: string, kind: string) =>
    graph.edges.some((e) => e.source === source && e.target === target && e.kind === kind);

  it("不包含私密内容，也不包含周记", () => {
    expect(ids).not.toContain("q-secret");
    expect(ids).not.toContain("w0-journal");
    expect(graphJson(graph)).not.toContain("私密的问题");
  });

  it("周按顺序连成主干，本周标为 current", () => {
    expect(has("w0", "w1", "sequence")).toBe(true);
    expect(has("w1", "w2", "sequence")).toBe(true);
    expect(graph.nodes.find((n) => n.id === "w0")?.state).toBe("current");
    expect(graph.nodes.find((n) => n.id === "w1")?.state).toBe("future");
    expect(has("me", "w0", "about")).toBe(true);
  });

  it("任务连到所属的周，并带完成状态", () => {
    expect(has("w0", "w0-1", "contains")).toBe(true);
    expect(graph.nodes.find((n) => n.id === "w0-1")?.state).toBe("done");
  });

  it("论文按「第 N 周」连到对应的周，没排周的连到「我」", () => {
    expect(has("w2", "p-react", "about")).toBe(true);
    expect(has("me", "p-free", "about")).toBe(true);
  });

  it("研究问题按创建日期连到当时那一周", () => {
    expect(has("w1", "q1", "about")).toBe(true);
  });

  it("嵌入页面时转义 <，防止提前结束 script 标签", () => {
    const tricky = buildGraph([entry({ id: "w9", kind: "week", title: "</script><b>", data: { start: "2026-01-01", end: "2026-01-07" } })], "我");
    expect(graphJson(tricky)).not.toContain("</script>");
  });
});
