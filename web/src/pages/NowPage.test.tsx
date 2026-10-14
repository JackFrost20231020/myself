import { describe, expect, it } from "vitest";
import type { Plan, Question } from "../../content/schema.ts";
import { testContent } from "../test-content.ts";
import { navOf, render } from "../test-render.tsx";

const plan: Plan = {
  weeks: [
    { id: "w0", title: "准备周", start: "2026-10-08", end: "2026-10-11", tasks: [{ id: "w0-1", title: "装好 skills", done: true }] },
    {
      id: "w1",
      title: "Neo4j 入门",
      start: "2026-10-12",
      end: "2026-10-18",
      tasks: [
        { id: "w1-1", title: "/teach 两节课", done: false },
        { id: "w1-2", title: "在本地装好 Neo4j", done: false },
        { id: "w1-3", title: "精读 KA-RAG", done: false },
      ],
    },
    { id: "w2", title: "想清楚任务 1", start: "2026-10-19", end: "2026-10-25", tasks: [] },
  ],
};

const withPlan = (p: Plan = plan, questions: Question[] = []) => testContent({ plan: p, questions });

describe("在做什么", () => {
  it("10 月 12–18 日打开首页，左页是第 1 周「Neo4j 入门」和它的 3 个任务", () => {
    const html = render("/", withPlan(), "2026-10-14");
    expect(html).toContain("第 1 周</span>Neo4j 入门");
    expect(html).toContain("/teach 两节课");
    expect(html).toContain("在本地装好 Neo4j");
    expect(html).toContain("精读 KA-RAG");
    expect(html).toContain("<b>0 / 3</b>");
    expect(html).toContain("下周 → 想清楚任务 1");
  });

  it("任务标成做完后，显示为已完成，完成数跟着变", () => {
    const done = structuredClone(plan);
    done.weeks[1]!.tasks[0]!.done = true;
    const html = render("/", withPlan(done), "2026-10-14");
    expect(html).toContain('class="check is-done"');
    expect(html).toContain("（已完成）");
    expect(html).toContain("<b>1 / 3</b>");
  });

  it("计划结束后提醒排下一个四周", () => {
    expect(render("/", withPlan(), "2026-11-02")).toContain("该排下一个四周了");
  });

  it("计划开始前显示第一周", () => {
    const html = render("/", withPlan(), "2026-10-01");
    expect(html).toContain("计划从 10月8日 开始");
    expect(html).toContain("装好 skills");
  });

  it("「在做什么」页面列出整个计划，标出这一周", () => {
    const html = render("/now", withPlan(), "2026-10-14");
    expect(html).toContain("一共 3 周、4 件事，做完了 1 件");
    expect(html).toContain('id="w1" class="week is-current"');
    expect(html).toContain('id="w0" class="week is-past"');
    expect(html).toContain('id="w2" class="week is-future"');
  });

  it("研究问题：没有时显示空状态，有时显示状态", () => {
    expect(render("/now", withPlan())).toContain("还没有公开的研究问题");
    const html = render("/now", withPlan(plan, [{ id: "q1", title: "图谱纠错怎么评测？", status: "想做" }]));
    expect(html).toContain("图谱纠错怎么评测？");
    expect(html).toContain('<span class="stamp">想做</span>');
  });

  it("有计划时导航里出现「在做什么」，没有时不出现", () => {
    expect(navOf(render("/", withPlan()))).toContain('href="/now"');
    expect(navOf(render("/", testContent()))).not.toContain('href="/now"');
  });
});
