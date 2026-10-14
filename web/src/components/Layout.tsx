import { Link, NavLink, Outlet } from "react-router";
import type { Content } from "../../content/schema.ts";
import { visibleSections } from "../sections.ts";

const REPO_URL = "https://github.com/JackFrost20231020/myself";

export function Layout({ content }: { content: Content }) {
  return (
    <div className="site">
      <a className="skip" href="#main">
        跳到正文
      </a>
      <header className="masthead">
        <Link to="/" className="brand" aria-label="霜，回到首页">
          <span className="brand-name">霜</span>
          <span className="brand-sub">{content.about.name} 的方格本</span>
        </Link>
        <nav className="nav" aria-label="栏目">
          {visibleSections(content).map((s) => (
            <NavLink key={s.to} to={s.to}>
              {s.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>内容由我口述、Claude 帮忙整理。</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          源代码
        </a>
      </footer>
    </div>
  );
}
