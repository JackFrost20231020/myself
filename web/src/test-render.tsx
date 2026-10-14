// 测试用：在指定地址把整个站渲染成 HTML 字符串
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import type { Content } from "../content/schema.ts";
import { App } from "./App.tsx";
import { testContent } from "./test-content.ts";

export function render(location: string, content: Content = testContent(), today = "2026-10-14"): string {
  return renderToStaticMarkup(
    <StaticRouter location={location}>
      <App content={content} today={today} />
    </StaticRouter>,
  );
}

// 取出导航里的链接部分
export function navOf(html: string): string {
  return /<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
}
