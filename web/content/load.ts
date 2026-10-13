// 读出 content/ 里的全部内容文件，检查格式，返回给页面用的数据。
// 任何一处不对都会一起报出来，每条都写明是哪个文件、哪个字段。
import fs from "node:fs";
import path from "node:path";
import { YAMLParseError, parse as parseYaml } from "yaml";
import { z } from "zod";
import { renderMarkdown } from "./markdown.ts";
import { type Content, aboutSchema, planSchema, questionsSchema, shelfSchema } from "./schema.ts";

z.config(z.locales.zhCN());

export class ContentError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`内容文件有 ${problems.length} 处问题：\n${problems.map((p) => `- ${p}`).join("\n")}`);
    this.name = "ContentError";
    this.problems = problems;
  }
}

// weeks[1]（w1）.tasks[0]（w1-1）.done
function describePath(data: unknown, parts: readonly PropertyKey[]): string {
  let out = "";
  let node: unknown = data;
  for (const part of parts) {
    node = node && typeof node === "object" ? (node as Record<PropertyKey, unknown>)[part] : undefined;
    if (typeof part === "number") {
      const id = node && typeof node === "object" ? (node as { id?: unknown }).id : undefined;
      out += `[${part}]${typeof id === "string" ? `（${id}）` : ""}`;
    } else {
      out += `${out ? "." : ""}${String(part)}`;
    }
  }
  return out;
}

class Reader {
  problems: string[] = [];
  dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  name(file: string): string {
    return `${path.basename(this.dir)}/${file}`;
  }

  text(file: string): string | undefined {
    const full = path.join(this.dir, file);
    if (!fs.existsSync(full)) {
      this.problems.push(`${this.name(file)}：文件不存在`);
      return undefined;
    }
    return fs.readFileSync(full, "utf8");
  }

  yaml(file: string, source: string | undefined): unknown {
    if (source === undefined) return undefined;
    try {
      return parseYaml(source);
    } catch (err) {
      if (err instanceof YAMLParseError) {
        const line = err.linePos?.[0]?.line;
        this.problems.push(`${this.name(file)}${line ? ` 第 ${line} 行` : ""}：YAML 格式不对（${err.code}）`);
        return undefined;
      }
      throw err;
    }
  }

  check<T>(schema: z.ZodType<T>, data: unknown, file: string): T | undefined {
    if (data === undefined) return undefined;
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      const where = describePath(data, issue.path);
      this.problems.push(`${this.name(file)}：${where || "整个文件"}：${issue.message}`);
    }
    return undefined;
  }
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function loadContent(dir: string): Content {
  const r = new Reader(dir);

  const aboutSource = r.text("about.md");
  let about: Content["about"] | undefined;
  if (aboutSource !== undefined) {
    const m = FRONTMATTER.exec(aboutSource);
    if (!m) {
      r.problems.push(`${r.name("about.md")}：开头要有用 --- 包起来的信息（name、facts）`);
    } else {
      const meta = r.check(aboutSchema, r.yaml("about.md", m[1]), "about.md");
      if (meta) about = { ...meta, bodyHtml: renderMarkdown((m[2] ?? "").trim()) };
    }
  }

  const plan = r.check(planSchema, r.yaml("plan.yaml", r.text("plan.yaml")), "plan.yaml");
  const shelf = r.check(shelfSchema, r.yaml("shelf.yaml", r.text("shelf.yaml")), "shelf.yaml");
  const questions = r.check(questionsSchema, r.yaml("questions.yaml", r.text("questions.yaml")), "questions.yaml");

  if (r.problems.length || !about || !plan || !shelf || !questions) throw new ContentError(r.problems);
  return { about, plan, papers: shelf.papers, questions: questions.questions };
}
