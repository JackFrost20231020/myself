// 内容文件的格式。字段名用英文，值用中文；每个对象都是严格的，多写或拼错字段会直接报错。
import { z } from "zod";
import { PAPER_STATUSES, QUESTION_STATUSES } from "./constants.ts";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期要写成 2026-10-12 这样");
const httpUrl = z.string().regex(/^https?:\/\/\S+$/, "链接只能以 http:// 或 https:// 开头");
const text = z.string().trim().min(1, "不能为空");

export const aboutSchema = z.strictObject({
  name: text,
  facts: z.array(z.strictObject({ label: text, value: text })).min(1).max(6),
});

const taskSchema = z.strictObject({
  id: z.string().regex(/^w\d+-\d+$/, "任务 id 要写成 w1-2 这样"),
  title: text,
  done: z.boolean(),
});

const weekSchema = z
  .strictObject({
    id: z.string().regex(/^w\d+$/, "周的 id 要写成 w1 这样"),
    title: text,
    start: isoDate,
    end: isoDate,
    tasks: z.array(taskSchema),
  })
  .refine((w) => w.start <= w.end, { message: "结束日期不能早于开始日期", path: ["end"] });

export const planSchema = z.strictObject({ weeks: z.array(weekSchema) }).superRefine((plan, ctx) => {
  const ids = new Set<string>();
  plan.weeks.forEach((w, i) => {
    const prev = plan.weeks[i - 1];
    if (prev && w.start <= prev.end) ctx.addIssue({ code: "custom", message: "这一周和上一周的日期重叠，或者顺序反了", path: ["weeks", i, "start"] });
    [w.id, ...w.tasks.map((t) => t.id)].forEach((id, j) => {
      if (ids.has(id)) ctx.addIssue({ code: "custom", message: `id「${id}」重复了`, path: j === 0 ? ["weeks", i, "id"] : ["weeks", i, "tasks", j - 1, "id"] });
      ids.add(id);
    });
    w.tasks.forEach((t, j) => {
      if (!t.id.startsWith(`${w.id}-`)) ctx.addIssue({ code: "custom", message: `任务 id 要以所在周的 id「${w.id}-」开头`, path: ["weeks", i, "tasks", j, "id"] });
    });
  });
});

const paperSchema = z.strictObject({
  id: text,
  title: text,
  status: z.enum(PAPER_STATUSES),
  venue: text.optional(),
  url: httpUrl.optional(),
  week: text.optional(),
  note: text.optional(),
});

export const shelfSchema = z.strictObject({ papers: z.array(paperSchema) }).superRefine((shelf, ctx) => uniqueIds(shelf.papers, "papers", ctx));

const questionSchema = z.strictObject({
  id: text,
  title: text,
  status: z.enum(QUESTION_STATUSES),
  note: text.optional(),
});

export const questionsSchema = z
  .strictObject({ questions: z.array(questionSchema) })
  .superRefine((q, ctx) => uniqueIds(q.questions, "questions", ctx));

function uniqueIds(list: { id: string }[], key: string, ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  list.forEach((item, i) => {
    if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `id「${item.id}」重复了`, path: [key, i, "id"] });
    seen.add(item.id);
  });
}

export type About = z.infer<typeof aboutSchema> & { bodyHtml: string };
export type Plan = z.infer<typeof planSchema>;
export type Week = Plan["weeks"][number];
export type Task = Week["tasks"][number];
export type Paper = z.infer<typeof paperSchema>;
export type Question = z.infer<typeof questionSchema>;

export type Content = {
  about: About;
  plan: Plan;
  papers: Paper[];
  questions: Question[];
};
