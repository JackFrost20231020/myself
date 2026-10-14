import { describe, expect, it } from "vitest";
import type { Paper } from "../../content/schema.ts";
import { testContent } from "../test-content.ts";
import { navOf, render } from "../test-render.tsx";

const LONG = "KA-RAG: Integrating Knowledge Graphs and Agentic Retrieval-Augmented Generation for an Intelligent Educational Question-Answering Model";

const papers: Paper[] = [
  { id: "p-karag", title: LONG, status: "想读", venue: "Applied Sciences 2025" },
  { id: "p-react", title: "ReAct", status: "想读", venue: "ICLR 2023", url: "https://arxiv.org/abs/2210.03629" },
  { id: "p-agents", title: "Building Effective Agents", status: "读完", url: "https://www.anthropic.com/engineering/building-effective-agents" },
];

const withPapers = (p: Paper[] = papers) => testContent({ papers: p });

describe("书架", () => {
  it("首页右页把每篇论文画成一根书脊，长标题能看到全名", () => {
    const html = render("/", withPapers());
    expect(html.match(/class="book book-\d/g)).toHaveLength(3);
    expect(html).toContain(`title="${LONG}"`);
    expect(html).toContain("想读 2 · 读完 1");
  });

  it("有链接的论文能点开原文，在新标签页打开", () => {
    expect(render("/", withPapers())).toContain('href="https://arxiv.org/abs/2210.03629" target="_blank" rel="noopener noreferrer"');
  });

  it("书架页按在读、想读、读完分组，标题完整显示", () => {
    const html = render("/shelf", withPapers());
    expect(html).toContain("在读 <small>0 篇</small>");
    expect(html).toContain("想读 <small>2 篇</small>");
    expect(html).toContain("读完 <small>1 篇</small>");
    expect(html).toContain(LONG);
  });

  it("改了状态后，论文换到对应分组，在读的排在书脊最前面", () => {
    const moved = papers.map((p) => (p.id === "p-react" ? { ...p, status: "在读" as const } : p));
    const shelf = render("/shelf", withPapers(moved));
    expect(shelf).toContain("在读 <small>1 篇</small>");
    const home = render("/", withPapers(moved));
    expect(home.indexOf("ReAct")).toBeLessThan(home.indexOf("KA-RAG"));
    expect(home).toContain("is-reading");
  });

  it("有论文时导航里出现「书架」，空书架时不出现", () => {
    expect(navOf(render("/", withPapers()))).toContain('href="/shelf"');
    expect(navOf(render("/", withPapers([])))).not.toContain('href="/shelf"');
  });
});
