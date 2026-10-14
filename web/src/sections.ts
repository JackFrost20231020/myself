import type { Content } from "../content/schema.ts";

export type Section = { to: string; label: string };

// 栏目：没有内容的栏目不放进导航（见 CONTEXT.md）
export function visibleSections(content: Content): Section[] {
  const sections: [Section, boolean][] = [
    [{ to: "/now", label: "在做什么" }, content.plan.weeks.length > 0 || content.questions.length > 0],
    [{ to: "/shelf", label: "书架" }, content.papers.length > 0],
    [{ to: "/about", label: "关于我" }, true],
  ];
  return sections.filter(([, show]) => show).map(([section]) => section);
}
