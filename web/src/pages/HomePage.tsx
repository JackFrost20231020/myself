import type { Content } from "../../content/schema.ts";
import { AboutCard } from "../components/AboutCard.tsx";
import { QuestionList } from "../components/QuestionList.tsx";
import { ThisWeek } from "../components/ThisWeek.tsx";

// 首页是摊开的方格本：左页是这一周，右页贴着关于我
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
        <section className="page page-right" aria-label="关于我">
          <AboutCard about={content.about} />
        </section>
      </div>
    </>
  );
}
