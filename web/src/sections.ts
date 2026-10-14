import type { Content } from "../content/schema.ts";

export type Section = { to: string; label: string };

// 栏目：没有内容的栏目不放进导航（见 CONTEXT.md）
export function visibleSections(content: Content): Section[] {
  const sections: [Section, boolean][] = [[{ to: "/about", label: "关于我" }, true]];
  void content;
  return sections.filter(([, show]) => show).map(([section]) => section);
}
