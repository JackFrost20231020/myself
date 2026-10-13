import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ContentError, loadContent } from "./load.ts";

const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");

const GOOD: Record<string, string> = {
  "about.md": "---\nname: JackFrost\nfacts:\n  - label: 身份\n    value: 研一\n---\n正文\n",
  "plan.yaml":
    'weeks:\n  - id: w0\n    title: 准备周\n    start: "2026-10-08"\n    end: "2026-10-11"\n    tasks:\n      - id: w0-1\n        title: 做一件事\n        done: false\n',
  "shelf.yaml": 'papers:\n  - id: p-a\n    title: 一篇论文\n    status: 想读\n    url: "https://example.com/a"\n',
  "questions.yaml": "questions: []\n",
};

// 在临时目录里放一套内容文件，可以替换或删掉其中几个
function load(overrides: Record<string, string | null> = {}) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "shuang-")), "content");
  fs.mkdirSync(dir);
  for (const [name, body] of Object.entries({ ...GOOD, ...overrides })) {
    if (body !== null) fs.writeFileSync(path.join(dir, name), body);
  }
  return loadContent(dir);
}

function problems(overrides: Record<string, string | null>): string {
  try {
    load(overrides);
  } catch (err) {
    if (err instanceof ContentError) return err.problems.join("\n");
    throw err;
  }
  throw new Error("本该报错，却通过了检查");
}

describe("内容文件", () => {
  it("仓库里的内容都能通过检查，数量和旧站一致", () => {
    const c = loadContent(CONTENT_DIR);
    const tasks = c.plan.weeks.flatMap((w) => w.tasks);
    expect(c.plan.weeks).toHaveLength(5);
    expect(tasks).toHaveLength(18);
    expect(tasks.filter((t) => t.done)).toHaveLength(1);
    expect(c.papers).toHaveLength(8);
    expect(c.papers.every((p) => p.status === "想读")).toBe(true);
    expect(c.about.name).toBe("JackFrost");
    expect(c.about.facts.map((f) => f.label)).toEqual(["身份", "方向", "近况"]);
  });

  it("字段的值不对时，指出文件和字段", () => {
    const out = problems({ "plan.yaml": GOOD["plan.yaml"]!.replace("done: false", "done: 是") });
    expect(out).toContain("content/plan.yaml：weeks[0]（w0）.tasks[0]（w0-1）.done");
  });

  it("YAML 写坏时，指出第几行", () => {
    expect(problems({ "plan.yaml": "weeks:\n  - id: w0\n   title: 缩进错了\n" })).toMatch(/content\/plan\.yaml 第 \d+ 行/);
  });

  it("拼错字段名时报错", () => {
    const out = problems({ "shelf.yaml": "papers:\n  - id: p-a\n    titel: 拼错了\n    status: 想读\n" });
    expect(out).toContain("content/shelf.yaml");
    expect(out).toContain("titel");
  });

  it("论文链接只接受 http 和 https", () => {
    const out = problems({ "shelf.yaml": GOOD["shelf.yaml"]!.replace("https://example.com/a", "javascript:alert(1)") });
    expect(out).toContain("papers[0]（p-a）.url");
  });

  it("书架状态只能是在读、想读、读完", () => {
    expect(problems({ "shelf.yaml": GOOD["shelf.yaml"]!.replace("想读", "书架") })).toContain("papers[0]（p-a）.status");
  });

  it("id 重复、日期顺序不对时报错", () => {
    const twoWeeks =
      GOOD["plan.yaml"]! +
      '  - id: w0\n    title: 又一个\n    start: "2026-10-01"\n    end: "2026-10-05"\n    tasks: []\n';
    const out = problems({ "plan.yaml": twoWeeks });
    expect(out).toContain("重复");
    expect(out).toContain("重叠");
  });

  it("缺少文件时报错，并一次报出所有问题", () => {
    const out = problems({ "questions.yaml": null, "about.md": "没有开头信息" });
    expect(out).toContain("content/questions.yaml：文件不存在");
    expect(out).toContain("content/about.md");
  });

  it("关于我的正文按安全的方式渲染，HTML 不会被执行", () => {
    const c = load({ "about.md": GOOD["about.md"]!.replace("正文", "<script>alert(1)</script> **加粗**") });
    expect(c.about.bodyHtml).toContain("&lt;script&gt;");
    expect(c.about.bodyHtml).toContain("<strong>加粗</strong>");
  });
});
