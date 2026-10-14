import { Link } from "react-router";
import type { Paper } from "../../content/schema.ts";
import { sortPapers } from "../lib/shelf.ts";

// 首页右页：书架画成一排书脊。标题太长时省略，鼠标停上去能看到完整标题。
export function BookSpines({ papers }: { papers: Paper[] }) {
  if (!papers.length) return <p className="empty-note">书架还是空的。</p>;
  return (
    <ul className="spines">
      {sortPapers(papers).map((p, i) => {
        const inner = (
          <>
            <span className="spine-title">{p.title}</span>
            <span className="spine-meta">{p.venue ?? p.status}</span>
          </>
        );
        const label = `${p.title}（${p.status}${p.venue ? `，${p.venue}` : ""}）`;
        return (
          <li key={p.id} className={`book book-${(i % 8) + 1} is-${p.status === "在读" ? "reading" : p.status === "读完" ? "done" : "todo"}`}>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.title} aria-label={label}>
                {inner}
              </a>
            ) : (
              <Link to={`/shelf#${p.id}`} title={p.title} aria-label={label}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
