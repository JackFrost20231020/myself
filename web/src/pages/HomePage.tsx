import type { Content } from "../../content/schema.ts";
import { AboutCard } from "../components/AboutCard.tsx";
import { monthDay } from "../lib/dates.ts";

// 首页是摊开的方格本：左页、书脊、右页
export function HomePage({ content, today }: { content: Content; today: string }) {
  return (
    <>
      <title>霜</title>
      <div className="spread">
        <section className="page page-left" aria-labelledby="home-intro">
          <p className="page-date">{monthDay(today)}</p>
          <h1 id="home-intro" className="hand-h">
            这本方格本
          </h1>
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.about.bodyHtml }} />
        </section>
        <div className="spine" aria-hidden="true" />
        <section className="page page-right" aria-label="关于我">
          <AboutCard about={content.about} />
        </section>
      </div>
    </>
  );
}
