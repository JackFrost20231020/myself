import type { Plan, Question } from "../../content/schema.ts";
import { QuestionList } from "../components/QuestionList.tsx";
import { TaskList } from "../components/TaskList.tsx";
import { monthDay } from "../lib/dates.ts";
import { doneCount, weekNumber, weekTense } from "../lib/plan.ts";

const TENSE_LABEL = { past: "已过", current: "这一周", future: "还没到" } as const;

// 在做什么：整个计划，加上研究问题
export function NowPage({ plan, questions, today }: { plan: Plan; questions: Question[]; today: string }) {
  const tasks = plan.weeks.flatMap((w) => w.tasks);
  return (
    <>
      <title>在做什么 · 霜</title>
      <article className="sheet sheet-wide">
        <h1 className="hand-h hand-h-lg">在做什么</h1>
        <p className="lede">
          按周排，每次只细排接下来四周。一共 {plan.weeks.length} 周、{tasks.length} 件事，做完了 {tasks.filter((t) => t.done).length} 件。
        </p>
        {plan.weeks.length ? (
          <ol className="weeks">
            {plan.weeks.map((w) => {
              const tense = weekTense(w, today);
              return (
                <li key={w.id} id={w.id} className={`week is-${tense}`}>
                  <div className="week-meta">
                    <span className="page-date">
                      {monthDay(w.start)} – {monthDay(w.end)}
                    </span>
                    <span className="week-tense">{TENSE_LABEL[tense]}</span>
                  </div>
                  <h2 className="hand-h week-title">
                    <span className={tense === "current" ? "circled" : "week-no"}>第 {weekNumber(w)} 周</span>
                    {w.title}
                  </h2>
                  {w.tasks.length ? <TaskList tasks={w.tasks} label={`第 ${weekNumber(w)} 周要做的`} /> : <p className="empty-note">这周没有排任务。</p>}
                  <p className="week-count">
                    做完 {doneCount(w)} / {w.tasks.length}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-note">还没有排计划。</p>
        )}
        <section className="now-questions" aria-labelledby="questions-title">
          <h2 id="questions-title" className="hand-h">
            在想的问题
          </h2>
          <QuestionList questions={questions} />
        </section>
      </article>
    </>
  );
}
