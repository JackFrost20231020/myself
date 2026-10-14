// 测试用的一份最小内容，各个测试按需覆盖其中的字段
import type { Content } from "../content/schema.ts";

export function testContent(overrides: Partial<Content> = {}): Content {
  return {
    about: {
      name: "JackFrost",
      facts: [
        { label: "身份", value: "研一" },
        { label: "方向", value: "知识图谱 × 大模型智能体" },
      ],
      bodyHtml: "<p>这里是我的方格本。</p>",
    },
    plan: { weeks: [] },
    papers: [],
    questions: [],
    ...overrides,
  };
}
