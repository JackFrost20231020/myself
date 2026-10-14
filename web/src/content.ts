import raw from "virtual:content";
import type { Content } from "../content/schema.ts";

// 构建时已经按 schema 检查过，这里只是给它加上类型
export const content: Content = raw;
