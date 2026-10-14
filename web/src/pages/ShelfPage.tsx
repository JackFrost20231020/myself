import type { Paper } from "../../content/schema.ts";
import { groupPapers, shelfSummary } from "../lib/shelf.ts";

// 书架：按在读、想读、读完分组，标题完整显示
export function ShelfPage({ papers }: { papers: Paper[] }) {
  return (
    <>
      <title>书架 · 霜</title>
      <article className="sheet sheet-wide">
        <h1 className="hand-h hand-h-lg">书架</h1>
        <p className="lede">在读、想读和读完的论文。{shelfSummary(papers)}。</p>
        {groupPapers(papers).map((g) => (
          <section key={g.status} className="shelf-group" aria-labelledby={`shelf-${g.status}`}>
            <h2 id={`shelf-${g.status}`} className="hand-h">
              {g.status} <small>{g.papers.length} 篇</small>
            </h2>
            {g.papers.length ? (
              <ul className="papers">
                {g.papers.map((p) => (
                  <li key={p.id} id={p.id} className="paper">
                    <p className="paper-title">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="paper-meta">
                      {[p.venue, p.week ? `打算${p.week}读` : undefined].filter(Boolean).join(" · ")}
                    </p>
                    {p.note ? <p className="paper-note">{p.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-note">还没有。</p>
            )}
          </section>
        ))}
      </article>
    </>
  );
}
