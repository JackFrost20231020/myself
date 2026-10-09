// 一个够用且安全的 Markdown 渲染器：先把所有 HTML 转义，再只支持少量格式。
// 支持：# 标题、- 列表、1. 列表、> 引用、``` 代码块、`行内代码`、**加粗**、[文字](http 链接)、空行分段。

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function inlineFormat(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// 行内代码里的内容不再做其他格式处理。
function inline(raw: string): string {
  const parts = raw.split("`");
  if (parts.length % 2 === 0) return inlineFormat(escapeHtml(raw));
  return parts.map((part, i) => (i % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : inlineFormat(escapeHtml(part)))).join("");
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("```")) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) code.push(lines[i++] ?? "");
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = (heading[1]?.length ?? 1) + 2; // # 渲染成 h3，避免和页面标题抢层级
      out.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? "");
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1] ?? "");
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();
  return out.join("\n");
}
