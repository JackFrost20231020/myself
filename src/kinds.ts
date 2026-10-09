import { z } from "zod";

export const KINDS = ["profile", "week", "task", "journal", "paper", "question", "devlog", "learn"] as const;
export type Kind = (typeof KINDS)[number];

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD");

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
const httpUrl = z.string().max(500).refine(isHttpUrl, "链接要以 http:// 或 https:// 开头");

export const PAPER_STATUSES = ["shelf", "reading", "done"] as const;
export const QUESTION_STATUSES = ["open", "want", "discussed", "dropped"] as const;

export const STATUS_LABELS: Record<string, string> = {
  shelf: "书架",
  reading: "在读",
  done: "读完",
  open: "待想",
  want: "想做",
  discussed: "已和导师讨论",
  dropped: "放弃",
};

// 每种内容在 data 字段里额外存什么。未知字段会被丢掉。
export const DATA_SCHEMAS = {
  profile: z.object({
    links: z.array(z.object({ label: z.string().min(1).max(40), url: httpUrl })).max(10).default([]),
  }),
  week: z.object({ start: isoDate, end: isoDate }).refine((d) => d.start <= d.end, "开始日期不能晚于结束日期"),
  task: z.object({ done: z.boolean().default(false) }),
  journal: z.object({}),
  paper: z.object({
    url: httpUrl.optional(),
    venue: z.string().max(80).optional(),
    status: z.enum(PAPER_STATUSES).default("shelf"),
    week: z.string().max(20).optional(),
  }),
  question: z.object({ status: z.enum(QUESTION_STATUSES).default("open") }),
  devlog: z.object({ date: isoDate.optional() }),
  learn: z.object({ date: isoDate.optional(), topic: z.string().max(80).optional() }),
} satisfies Record<Kind, z.ZodType>;

type KindMeta = {
  label: string;
  plural: string;
  path?: string;
  parent?: Kind;
  defaultVisibility: Visibility;
  titleLabel: string;
  bodyLabel?: string;
};

export const KIND_META: Record<Kind, KindMeta> = {
  profile: { label: "主页信息", plural: "主页信息", defaultVisibility: "public", titleLabel: "网站名称", bodyLabel: "简介" },
  week: { label: "周", plural: "计划", path: "plan", defaultVisibility: "public", titleLabel: "主题", bodyLabel: "备注" },
  task: { label: "任务", plural: "任务", parent: "week", defaultVisibility: "public", titleLabel: "任务" },
  journal: { label: "周记", plural: "周记", parent: "week", defaultVisibility: "private", titleLabel: "标题", bodyLabel: "周记" },
  paper: { label: "论文", plural: "论文", path: "papers", defaultVisibility: "private", titleLabel: "标题", bodyLabel: "笔记" },
  question: { label: "研究问题", plural: "研究问题", path: "questions", defaultVisibility: "private", titleLabel: "问题", bodyLabel: "想法" },
  devlog: { label: "开发日志", plural: "开发日志", path: "log", defaultVisibility: "private", titleLabel: "标题", bodyLabel: "内容" },
  learn: { label: "学习记录", plural: "学习记录", path: "learn", defaultVisibility: "private", titleLabel: "标题", bodyLabel: "内容" },
};

// 后台和公开页里能单独列出来的内容类型，以及它们的网址片段。
export const LIST_KINDS = ["paper", "question", "devlog", "learn"] as const satisfies readonly Kind[];
export type ListKind = (typeof LIST_KINDS)[number];

export function kindFromPath(path: string): ListKind | undefined {
  return LIST_KINDS.find((k) => KIND_META[k].path === path);
}
