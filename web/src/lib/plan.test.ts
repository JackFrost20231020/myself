import { describe, expect, it } from "vitest";
import type { Plan } from "../../content/schema.ts";
import { todayInShanghai } from "./dates.ts";
import { doneCount, weekStatus, weekTense } from "./plan.ts";

const plan: Plan = {
  weeks: [
    { id: "w0", title: "准备周", start: "2026-10-08", end: "2026-10-11", tasks: [] },
    {
      id: "w1",
      title: "Neo4j 入门",
      start: "2026-10-12",
      end: "2026-10-18",
      tasks: [
        { id: "w1-1", title: "一", done: true },
        { id: "w1-2", title: "二", done: false },
      ],
    },
    // 留一个空档：10-19 到 10-25 没排
    { id: "w2", title: "想清楚任务 1", start: "2026-10-26", end: "2026-11-01", tasks: [] },
  ],
};

describe("今天是计划里的哪一周", () => {
  it("计划开始前：显示第一周", () => {
    expect(weekStatus(plan, "2026-10-07")).toMatchObject({ kind: "before", next: { id: "w0" } });
  });

  it("一周的第一天和最后一天都算这一周", () => {
    expect(weekStatus(plan, "2026-10-12")).toMatchObject({ kind: "current", week: { id: "w1" }, next: { id: "w2" } });
    expect(weekStatus(plan, "2026-10-18")).toMatchObject({ kind: "current", week: { id: "w1" } });
  });

  it("两周交界：前一周最后一天之后就是下一周", () => {
    expect(weekStatus(plan, "2026-10-11")).toMatchObject({ kind: "current", week: { id: "w0" }, next: { id: "w1" } });
    expect(weekStatus(plan, "2026-10-12")).toMatchObject({ kind: "current", week: { id: "w1" } });
  });

  it("计划里的空档：显示下一周", () => {
    expect(weekStatus(plan, "2026-10-20")).toMatchObject({ kind: "gap", next: { id: "w2" } });
  });

  it("计划结束后：显示最后一周", () => {
    expect(weekStatus(plan, "2026-11-02")).toMatchObject({ kind: "after", last: { id: "w2" } });
  });

  it("没有计划", () => {
    expect(weekStatus({ weeks: [] }, "2026-10-14")).toEqual({ kind: "empty" });
  });

  it("按北京时间算日期：UTC 16 点以后已经是北京时间的第二天", () => {
    expect(todayInShanghai(new Date("2026-10-11T15:59:00Z"))).toBe("2026-10-11");
    expect(todayInShanghai(new Date("2026-10-11T16:00:00Z"))).toBe("2026-10-12");
  });

  it("完成数和每周的时态", () => {
    const w1 = plan.weeks[1]!;
    expect(doneCount(w1)).toBe(1);
    expect(weekTense(w1, "2026-10-11")).toBe("future");
    expect(weekTense(w1, "2026-10-15")).toBe("current");
    expect(weekTense(w1, "2026-10-19")).toBe("past");
  });
});
