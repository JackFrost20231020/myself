import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";
import { shortDate } from "../dates";
import { isHttpUrl } from "../kinds";
import { renderMarkdown } from "../markdown";
import type { Entry } from "../store";

export type SiteInfo = { title: string; bio: string; links: { label: string; url: string }[] };

export function siteFromProfile(profile: Entry | null): SiteInfo {
  const rawLinks = Array.isArray(profile?.data.links) ? (profile?.data.links as unknown[]) : [];
  const links = rawLinks.flatMap((l) => {
    const link = l as { label?: unknown; url?: unknown };
    return typeof link.label === "string" && typeof link.url === "string" && isHttpUrl(link.url)
      ? [{ label: link.label, url: link.url }]
      : [];
  });
  return { title: profile?.title || "我的学习主页", bio: profile?.body ?? "", links };
}

const PUBLIC_NAV: [string, string][] = [
  ["/", "主页"],
  ["/plan", "计划"],
  ["/papers", "论文"],
  ["/questions", "研究问题"],
  ["/log", "开发日志"],
  ["/learn", "学习记录"],
];

const ADMIN_NAV: [string, string][] = [
  ["/admin", "概览"],
  ["/admin/plan", "计划"],
  ["/admin/papers", "论文"],
  ["/admin/questions", "研究问题"],
  ["/admin/log", "开发日志"],
  ["/admin/learn", "学习记录"],
  ["/admin/profile", "主页信息"],
  ["/admin/history", "修改历史"],
  ["/admin/feed", "AI 资讯"],
];

const REPO_URL = "https://github.com/JackFrost20231020/myself";

// 标志：仪表圆圈（ISA 符号）里写 KG
const Logo: FC = () => (
  <svg class="logo" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    <circle class="logo-ring" cx="16" cy="16" r="13.5" />
    <line class="logo-line" x1="2.5" y1="16" x2="29.5" y2="16" />
    <text class="logo-text" x="16" y="11.2" text-anchor="middle" dominant-baseline="central">
      KG
    </text>
    <circle class="logo-dot" cx="11" cy="22" r="1.9" />
    <circle class="logo-dot" cx="21" cy="22" r="1.9" />
    <line class="logo-edge" x1="12.6" y1="22" x2="19.4" y2="22" />
  </svg>
);

type LayoutProps = PropsWithChildren<{
  site: SiteInfo;
  title?: string;
  path: string;
  authed: boolean;
  admin?: boolean;
  // 还没有公开内容的栏目，先不放进导航（当前所在的页面除外）
  hiddenNav?: string[];
}>;

export const Layout: FC<LayoutProps> = ({ site, title, path, authed, admin, hiddenNav = [], children }) => {
  const fullTitle = title ? `${title} · ${site.title}` : site.title;
  const description = site.bio.replace(/\s+/g, " ").slice(0, 120) || site.title;
  const nav = admin ? ADMIN_NAV : PUBLIC_NAV.filter(([href]) => href === path || !hiddenNav.includes(href));
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <title>{fullTitle}</title>
          <meta name="description" content={description} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={site.title} />
          <meta property="og:title" content={fullTitle} />
          <meta property="og:description" content={description} />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href="/app.css" />
          <script src={admin ? "/admin.js" : "/site.js"} defer></script>
        </head>
        <body class={admin ? "is-admin" : "is-public"}>
          <a class="skip" href="#main">
            跳到正文
          </a>
          <header class="site-header">
            <div class="wrap header-row">
              <a class="brand" href={admin ? "/admin" : "/"}>
                <Logo />
                <span class="brand-name">{site.title}</span>
                {admin ? <span class="chip chip-accent">后台</span> : null}
              </a>
              <nav class="nav" aria-label={admin ? "后台导航" : "主导航"}>
                {nav.map(([href, label]) => (
                  <a href={href} aria-current={path === href ? "page" : undefined}>
                    {label}
                  </a>
                ))}
              </nav>
              {admin ? (
                <div class="header-actions">
                  <a href="/" target="_blank" rel="noopener">
                    看公开页
                  </a>
                  <form method="post" action="/admin/logout">
                    <button type="submit" class="link-button">
                      退出
                    </button>
                  </form>
                </div>
              ) : authed ? (
                <div class="header-actions">
                  <a class="button-small" href="/admin">
                    进后台
                  </a>
                </div>
              ) : null}
            </div>
          </header>
          <main class="wrap main" id="main">
            {children}
          </main>
          <footer class="site-footer">
            <div class="wrap footer-row">
              <span>
                {admin
                  ? "改动会立即生效。每次改动都记在「修改历史」里，可以撤销。"
                  : "学习图纸 · 内容随学习进度实时更新"}
              </span>
              {admin ? null : (
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  源代码
                </a>
              )}
            </div>
          </footer>
        </body>
      </html>
    </>
  );
};

export const Markdown: FC<{ text: string }> = ({ text }) =>
  text.trim() ? <div class="md">{raw(renderMarkdown(text))}</div> : null;

export const VisBadge: FC<{ entry: Entry }> = ({ entry }) =>
  entry.visibility === "public" ? <span class="vis vis-public">公开</span> : <span class="vis vis-private">私密</span>;

export function weekNumber(week: Entry, index: number): string {
  const m = /^w(\d+)$/.exec(week.id);
  return m ? (m[1] ?? String(index)) : String(index);
}

export const Bubble: FC<{ top: string; bottom: string }> = ({ top, bottom }) => (
  <span class="bubble" aria-hidden="true">
    <span>{top}</span>
    <span>{bottom}</span>
  </span>
);

export function weekRange(week: Entry): string {
  const start = shortDate(week.data.start);
  const end = shortDate(week.data.end);
  return start && end ? `${start} – ${end}` : "";
}

export function isDone(task: Entry): boolean {
  return task.data.done === true;
}

export const Empty: FC<{ text: string }> = ({ text }) => <p class="empty">{text}</p>;
