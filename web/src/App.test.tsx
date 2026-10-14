import { describe, expect, it } from "vitest";
import { testContent } from "./test-content.ts";
import { navOf, render } from "./test-render.tsx";

describe("页面骨架", () => {
  it("首页是摊开的方格本，有站名「霜」和关于我的卡片", () => {
    const html = render("/");
    expect(html).toContain('class="brand-name">霜<');
    expect(html).toContain('class="spread"');
    expect(html).toContain("JackFrost");
    expect(html).toContain("知识图谱 × 大模型智能体");
    expect(html).toContain('aria-labelledby="this-week"');
  });

  it("关于我页面显示全部信息和正文", () => {
    const html = render("/about");
    expect(html).toContain("<dt>身份</dt><dd>研一</dd>");
    expect(html).toContain("<p>这里是我的方格本。</p>");
  });

  it("改了内容，页面跟着变", () => {
    const html = render("/", testContent({ about: { name: "霜的主人", facts: [{ label: "近况", value: "在读 ReAct" }], bodyHtml: "" } }));
    expect(html).toContain("霜的主人");
    expect(html).toContain("在读 ReAct");
  });

  it("不存在的地址显示 404 页面", () => {
    expect(render("/no-such-page")).toContain("这一页是空白的");
  });

  it("导航里只有已经有内容的栏目", () => {
    const nav = navOf(render("/"));
    expect(nav).toContain('href="/about"');
    expect(nav).not.toContain('href="/notes"');
  });
});
