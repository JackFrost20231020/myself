import { Link } from "react-router";
import type { Plan, Week } from "../../content/schema.ts";
import { monthDay } from "../lib/dates.ts";
import { doneCount, weekNumber, weekStatus } from "../lib/plan.ts";
import { TaskList } from "./TaskList.tsx";

function WeekHeading({ week, id }: { week: Week; id: string }) {
  return (
    <>
      <p className="page-date">
        {monthDay(week.start)} – {monthDay(week.end)}
      </p>
      <h2 id={id} className="hand-h week-title">
        <span className="circled">第 {weekNumber(week)} 周</span>
        {week.title}
      </h2>
    </>
  );
}

function NextWeek({ week }: { week: Week | undefined }) {
  if (!week) return null;
  return (
    <p className="next-week">
      下周 → {week.title}
      <span className="sr-only">（{monthDay(week.start)} 开始）</span>
    </p>
  );
}

// 首页左页：这一周
export function ThisWeek({ plan, today }: { plan: Plan; today: string }) {
  const status = weekStatus(plan, today);
  const id = "this-week";

  if (status.kind === "empty") {
    return (
      <>
        <h2 id={id} className="hand-h">
          这一周
        </h2>
        <p className="empty-note">还没有排计划。</p>
      </>
    );
  }

  if (status.kind === "current") {
    const { week, next } = status;
    const done = doneCount(week);
    const total = week.tasks.length;
    return (
      <>
        <WeekHeading week={week} id={id} />
        {total ? (
          <>
            <TaskList tasks={week.tasks} label="这周要做的" />
            <p className="annotation" aria-hidden="true">
              {done === total ? "↑ 这周的都做完了" : `↑ 这周就这 ${total} 件`}
            </p>
          </>
        ) : (
          <p className="empty-note">这周没有排任务。</p>
        )}
        <div className="tally">
          <b>
            {done} / {total}
          </b>
          <span>做完一件，在对话里说一声就勾上</span>
        </div>
        <NextWeek week={next} />
        <Link to="/now" className="more">
          整个计划 <span aria-hidden="true">→</span>
        </Link>
      </>
    );
  }

  const upcoming = status.kind === "after" ? status.last : status.next;
  const lead =
    status.kind === "before"
      ? `计划从 ${monthDay(upcoming.start)} 开始。`
      : status.kind === "gap"
        ? `这几天计划里没排事，下一周从 ${monthDay(upcoming.start)} 开始。`
        : `计划到 ${monthDay(upcoming.end)} 就排完了，该排下一个四周了。`;
  return (
    <>
      <h2 id={id} className="hand-h">
        这一周
      </h2>
      <p className="empty-note">{lead}</p>
      <WeekHeading week={upcoming} id={`${id}-upcoming`} />
      <TaskList tasks={upcoming.tasks} label={`${upcoming.title}要做的`} />
      <Link to="/now" className="more">
        整个计划 <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}
