import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listFeed, parseAihotItems, refreshAihot } from "../src/feed";
import { renderMarkdown } from "../src/markdown";
import { setupDb } from "./helpers";

describe("Markdown 渲染", () => {
  it("HTML 一律转义，不会执行脚本", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("只把 http/https 链接变成超链接", () => {
    expect(renderMarkdown("[论文](https://arxiv.org/abs/2210.03629)")).toContain('href="https://arxiv.org/abs/2210.03629"');
    expect(renderMarkdown("[点我](javascript:alert(1))")).not.toContain("href=");
  });

  it("支持加粗、行内代码、列表和代码块", () => {
    const html = renderMarkdown("**重点** 和 `MERGE`\n\n- 第一条\n- 第二条\n\n```\nMATCH (n) RETURN n\n```");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<code>MERGE</code>");
    expect(html).toContain("<ul><li>第一条</li><li>第二条</li></ul>");
    expect(html).toContain("<pre><code>MATCH (n) RETURN n</code></pre>");
  });
});

const sample = {
  schemaVersion: 1,
  items: [
    {
      id: "a1",
      title: "某模型发布",
      originalTitle: null,
      summary: "摘要",
      reason: "推荐理由",
      source: { name: "官方博客" },
      links: { aihot: "https://aihot.news/items/a1", original: "https://example.com/a1" },
      publishedAt: "2026-10-09T01:00:00Z",
      discoveredAt: "2026-10-09T01:05:00Z",
      category: "ai-models",
      score: 88,
      selected: true,
    },
    { id: "broken" },
  ],
  page: { count: 2, hasMore: false, nextCursor: null },
};

describe("AIHOT 拉取", () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => {
    ({ db, dispose } = await setupDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it("格式不对的条目会被跳过", () => {
    const items = parseAihotItems(sample, "2026-10-09T02:00:00Z");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "a1", url: "https://aihot.news/items/a1", sourceName: "官方博客", reason: "推荐理由" });
  });

  it("拉取后存进数据库，重复拉取只更新不重复", async () => {
    const fakeFetch = (async () => new Response(JSON.stringify(sample), { status: 200 })) as unknown as typeof fetch;
    await refreshAihot(db, fakeFetch);
    await refreshAihot(db, fakeFetch);
    const items = await listFeed(db);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("某模型发布");
  });

  it("AIHOT 出错时抛出带状态码的错误", async () => {
    const failing = (async () => new Response("busy", { status: 503 })) as unknown as typeof fetch;
    await expect(refreshAihot(db, failing)).rejects.toThrow("503");
  });
});
