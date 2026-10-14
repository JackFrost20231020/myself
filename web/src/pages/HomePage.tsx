import { Link } from "react-router";
import type { Content } from "../../content/schema.ts";
import { AboutCard } from "../components/AboutCard.tsx";
import { BookSpines } from "../components/BookSpines.tsx";
import { QuestionList } from "../components/QuestionList.tsx";
import { ThisWeek } from "../components/ThisWeek.tsx";
import { shelfSummary } from "../lib/shelf.ts";

// 首页是摊开的方格本：左页是这一周，右页贴着关于我、下面是书架
export function HomePage({ content, today }: { content: Content; today: string }) {
  return (
    <>
      <title>霜</title>
      <h1 className="sr-only">霜：{content.about.name} 的方格本</h1>
      <div className="spread">
        <section className="page page-left" aria-labelledby="this-week">
          <ThisWeek plan={content.plan} today={today} />
          <h2 className="hand-h hand-h-sm">在想的问题</h2>
          <QuestionList questions={content.questions} />
        </section>
        <div className="spine" aria-hidden="true" />
        <div className="page page-right">
          <AboutCard about={content.about} />
          <section aria-labelledby="home-shelf">
            <h2 id="home-shelf" className="hand-h hand-h-sm">
              书架 <small>{shelfSummary(content.papers)}</small>
            </h2>
            <BookSpines papers={content.papers} />
            {content.papers.length ? (
              <Link to="/shelf" className="more">
                整个书架 <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
