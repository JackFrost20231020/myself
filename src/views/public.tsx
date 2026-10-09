import { Hono, type Context } from "hono";
import type { FC } from "hono/jsx";
import { formatShanghai, shortDate, todayInShanghai } from "../dates";
import type { AppEnv } from "../env";
import { KIND_META, STATUS_LABELS, type ListKind } from "../kinds";
import { type Entry, findWeekByDate, getEntry, listEntries } from "../store";
import { Bubble, Empty, Layout, Markdown, type SiteInfo, isDone, siteFromProfile, weekNumber, weekRange } from "./layout";

// 公开页面：只显示 visibility = public 的内容。
export const pages = new Hono<AppEnv>();

async function loadSite(db: D1Database): Promise<SiteInfo> {
  return siteFromProfile(await getEntry(db, "profile"));
}

function byDateDesc(a: Entry, b: Entry): number {
  const da = (typeof a.data.date === "string" && a.data.date) || a.createdAt;
  const db = (typeof b.data.date === "string" && b.data.date) || b.createdAt;
  return db.localeCompare(da);
}

const PAPER_ORDER = ["reading", "shelf", "done"];
function byPaperStatus(a: Entry, b: Entry): number {
  return PAPER_ORDER.indexOf(String(a.data.status ?? "shelf")) - PAPER_ORDER.indexOf(String(b.data.status ?? "shelf")) || a.sort - b.sort;
}

const QUESTION_ORDER = ["want", "open", "discussed", "dropped"];
function byQuestionStatus(a: Entry, b: Entry): number {
  return (
    QUESTION_ORDER.indexOf(String(a.data.status ?? "open")) - QUESTION_ORDER.indexOf(String(b.data.status ?? "open")) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

const TaskList: FC<{ tasks: Entry[] }> = ({ tasks }) => (
  <ul class="tasks">
    {tasks.map((t) => (
      <li class={isDone(t) ? "task is-done" : "task"}>
        <span class="tick" aria-label={isDone(t) ? "已完成" : "未完成"}>
          {isDone(t) ? "✓" : ""}
        </span>
        <span class="task-text">{t.title}</span>
      </li>
    ))}
  </ul>
);

const Progress: FC<{ tasks: Entry[] }> = ({ tasks }) => {
  const done = tasks.filter(isDone).length;
  return (
    <span class="progress-wrap">
      <progress max={Math.max(tasks.length, 1)} value={done}></progress>
      <span class="count">
        {done} / {tasks.length}
      </span>
    </span>
  );
};

const PaperItem: FC<{ paper: Entry }> = ({ paper }) => {
  const url = typeof paper.data.url === "string" ? paper.data.url : null;
  const meta = [paper.data.venue, paper.data.week].filter((v) => typeof v === "string" && v).join(" · ");
  return (
    <li class="item">
      <div class="item-head">
        <span class={`status status-${String(paper.data.status ?? "shelf")}`}>{STATUS_LABELS[String(paper.data.status ?? "shelf")]}</span>
        {url ? (
          <a class="item-title" href={url} target="_blank" rel="noopener noreferrer">
            {paper.title}
          </a>
        ) : (
          <span class="item-title">{paper.title}</span>
        )}
      </div>
      {meta ? <p class="item-meta">{meta}</p> : null}
      {paper.body.trim() ? (
        <details class="notes">
          <summary>笔记</summary>
          <Markdown text={paper.body} />
        </details>
      ) : null}
    </li>
  );
};

const QuestionItem: FC<{ q: Entry }> = ({ q }) => (
  <li class="item">
    <div class="item-head">
      <span class={`status status-${String(q.data.status ?? "open")}`}>{STATUS_LABELS[String(q.data.status ?? "open")]}</span>
      <span class="item-title">{q.title}</span>
    </div>
    <Markdown text={q.body} />
  </li>
);

const LogItem: FC<{ entry: Entry }> = ({ entry }) => (
  <article class="log">
    <p class="item-meta">
      {typeof entry.data.date === "string" ? entry.data.date : formatShanghai(entry.createdAt, true).slice(0, 10)}
      {typeof entry.data.topic === "string" && entry.data.topic ? ` · ${entry.data.topic}` : ""}
    </p>
    <h3>{entry.title}</h3>
    <Markdown text={entry.body} />
  </article>
);

pages.get("/", async (c) => {
  const db = c.env.DB;
  const site = await loadSite(db);
  const week = await findWeekByDate(db, todayInShanghai(), false);
  const [tasks, papers, questions, logs, learns] = await Promise.all([
    week ? listEntries(db, { kind: "task", parentId: week.id, includePrivate: false }) : Promise.resolve([]),
    listEntries(db, { kind: "paper", includePrivate: false }),
    listEntries(db, { kind: "question", includePrivate: false }),
    listEntries(db, { kind: "devlog", includePrivate: false }),
    listEntries(db, { kind: "learn", includePrivate: false }),
  ]);
  const done = tasks.filter(isDone).length;

  return c.html(
    <Layout site={site} path="/" authed={c.get("authed")}>
      <section class="titleblock">
        <div class="tb-name">
          <h1>{site.title}</h1>
          <Markdown text={site.bio} />
          {site.links.length ? (
            <p class="links">
              {site.links.map((l) => (
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          ) : null}
        </div>
        <dl class="tb-fields">
          <div>
            <dt>今天</dt>
            <dd>{shortDate(todayInShanghai())}</dd>
          </div>
          <div>
            <dt>本周主题</dt>
            <dd>{week ? week.title : "—"}</dd>
          </div>
          <div>
            <dt>本周进度</dt>
            <dd>{week ? `${done} / ${tasks.length}` : "—"}</dd>
          </div>
          <div>
            <dt>在读论文</dt>
            <dd>{papers.filter((p) => p.data.status === "reading").length}</dd>
          </div>
        </dl>
      </section>

      {week ? (
        <section class="block">
          <div class="block-head">
            <h2>本周 · {week.title}</h2>
            <a href="/plan">完整计划 →</a>
          </div>
          <p class="item-meta">{weekRange(week)}</p>
          <TaskList tasks={tasks} />
        </section>
      ) : null}

      {papers.length ? (
        <section class="block">
          <div class="block-head">
            <h2>在读与书架</h2>
            <a href="/papers">全部论文 →</a>
          </div>
          <ul class="items">
            {[...papers].sort(byPaperStatus).slice(0, 5).map((p) => <PaperItem paper={p} />)}
          </ul>
        </section>
      ) : null}

      {questions.length ? (
        <section class="block">
          <div class="block-head">
            <h2>研究问题</h2>
            <a href="/questions">全部 →</a>
          </div>
          <ul class="items">
            {[...questions].sort(byQuestionStatus).slice(0, 5).map((q) => <QuestionItem q={q} />)}
          </ul>
        </section>
      ) : null}

      {logs.length || learns.length ? (
        <section class="block two-col">
          {logs.length ? (
            <div>
              <div class="block-head">
                <h2>开发日志</h2>
                <a href="/log">全部 →</a>
              </div>
              {[...logs].sort(byDateDesc).slice(0, 3).map((e) => <LogItem entry={e} />)}
            </div>
          ) : null}
          {learns.length ? (
            <div>
              <div class="block-head">
                <h2>学习记录</h2>
                <a href="/learn">全部 →</a>
              </div>
              {[...learns].sort(byDateDesc).slice(0, 3).map((e) => <LogItem entry={e} />)}
            </div>
          ) : null}
        </section>
      ) : null}
    </Layout>,
  );
});

pages.get("/plan", async (c) => {
  const db = c.env.DB;
  const site = await loadSite(db);
  const weeks = await listEntries(db, { kind: "week", includePrivate: false });
  const [tasks, journals] = await Promise.all([
    listEntries(db, { kind: "task", includePrivate: false }),
    listEntries(db, { kind: "journal", includePrivate: false }),
  ]);
  const today = todayInShanghai();
  return c.html(
    <Layout site={site} title="计划" path="/plan" authed={c.get("authed")}>
      <div class="page-head">
        <h1>学习计划</h1>
        <p class="lede">按周排，每周三四件事。勾掉的是已经做完的。</p>
      </div>
      {weeks.length ? (
        <div class="weeks">
          {weeks.map((w, i) => {
            const own = tasks.filter((t) => t.parentId === w.id);
            const journal = journals.find((j) => j.parentId === w.id);
            const isNow = String(w.data.start) <= today && today <= String(w.data.end);
            return (
              <article class={isNow ? "week is-now" : "week"} id={w.id}>
                <div class="week-head">
                  <Bubble top="WK" bottom={weekNumber(w, i)} />
                  <div class="week-title">
                    <span class="item-meta">{weekRange(w)}</span>
                    <h2>{w.title}</h2>
                  </div>
                  {isNow ? <span class="now">本周</span> : null}
                  <Progress tasks={own} />
                </div>
                <Markdown text={w.body} />
                <TaskList tasks={own} />
                {journal && journal.body.trim() ? (
                  <div class="journal">
                    <p class="item-meta">周记</p>
                    <Markdown text={journal.body} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty text="还没有公开的计划。" />
      )}
    </Layout>,
  );
});

function listPage(kind: ListKind, intro: string) {
  return async (c: Context<AppEnv>) => {
    const db = c.env.DB;
    const site = await loadSite(db);
    const meta = KIND_META[kind];
    const entries = await listEntries(db, { kind, includePrivate: false });
    let body;
    if (kind === "paper") {
      const groups = PAPER_ORDER.map((status) => ({ status, items: entries.filter((p) => (p.data.status ?? "shelf") === status) })).filter(
        (g) => g.items.length,
      );
      body = groups.map((g) => (
        <section class="block">
          <h2>{STATUS_LABELS[g.status]}</h2>
          <ul class="items">
            {g.items.map((p) => (
              <PaperItem paper={p} />
            ))}
          </ul>
        </section>
      ));
    } else if (kind === "question") {
      body = (
        <ul class="items">
          {[...entries].sort(byQuestionStatus).map((q) => (
            <QuestionItem q={q} />
          ))}
        </ul>
      );
    } else {
      body = [...entries].sort(byDateDesc).map((e) => <LogItem entry={e} />);
    }
    return c.html(
      <Layout site={site} title={meta.plural} path={`/${meta.path}`} authed={c.get("authed")}>
        <div class="page-head">
          <h1>{meta.plural}</h1>
          <p class="lede">{intro}</p>
        </div>
        {entries.length ? body : <Empty text={`还没有公开的${meta.plural}。`} />}
      </Layout>,
    );
  };
}

pages.get("/papers", listPage("paper", "在读、待读和读完的论文。展开「笔记」可以看我的读书笔记。"));
pages.get("/questions", listPage("question", "读论文和做项目时冒出来的问题，研究方向会从这里选。"));
pages.get("/log", listPage("devlog", "做项目时每周的进展、遇到的问题和解决办法。"));
pages.get("/learn", listPage("learn", "系统学习一个主题时留下的记录。"));
