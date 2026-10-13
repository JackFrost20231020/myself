import { Hono, type Context } from "hono";
import type { FC } from "hono/jsx";
import { formatShanghai, shortDate, todayInShanghai } from "../dates";
import type { AppEnv } from "../env";
import { buildGraph } from "../graph";
import { KIND_META, STATUS_LABELS, type ListKind } from "../kinds";
import { type Entry, getEntry, listEntries } from "../store";
import {
  Bar,
  Chip,
  EmptyState,
  GraphPanel,
  PaperCard,
  type PipeWeek,
  Pipeline,
  ProgressRing,
  QuestionCard,
  SectionHead,
  Stat,
  TaskChecklist,
  Timeline,
  type TimelineItem,
  type Tone,
} from "./components";
import { Bubble, Layout, Markdown, type SiteInfo, isDone, siteFromProfile, weekNumber, weekRange } from "./layout";

// 公开页面：只读 visibility = public 的内容（父级私密的子内容也不算公开）。
export const pages = new Hono<AppEnv>();

async function loadSite(db: D1Database): Promise<SiteInfo> {
  return siteFromProfile(await getEntry(db, "profile"));
}

type WeekState = "done" | "current" | "future";

type Model = {
  today: string;
  weeks: Entry[];
  tasksByWeek: Map<string, Entry[]>;
  stateOf: (w: Entry) => WeekState;
  focusWeek: Entry | null;
  pipe: PipeWeek[];
  papers: Entry[];
  questions: Entry[];
  logs: Entry[];
  learns: Entry[];
  journals: Entry[];
  tasksDone: number;
  tasksTotal: number;
  recent: TimelineItem[];
  lastUpdate: string;
};

const PAPER_ORDER = ["reading", "shelf", "done"];
const QUESTION_ORDER = ["want", "open", "discussed", "dropped"];

function entryDate(e: Entry): string {
  return typeof e.data.date === "string" && e.data.date ? e.data.date : todayInShanghai(new Date(e.createdAt));
}

function byDateDesc(a: Entry, b: Entry): number {
  return entryDate(b).localeCompare(entryDate(a)) || b.createdAt.localeCompare(a.createdAt);
}

function byPaperStatus(a: Entry, b: Entry): number {
  const sa = PAPER_ORDER.indexOf(String(a.data.status ?? "shelf"));
  const sb = PAPER_ORDER.indexOf(String(b.data.status ?? "shelf"));
  return sa - sb || a.sort - b.sort;
}

function recentItem(e: Entry): TimelineItem | null {
  const date = shortDate(todayInShanghai(new Date(e.updatedAt)));
  switch (e.kind) {
    case "task":
      return { date, verb: isDone(e) ? "完成了" : "计划了", title: e.title, href: `/plan#${e.parentId}`, tone: isDone(e) ? "accent" : "muted" };
    case "paper": {
      const s = String(e.data.status ?? "shelf");
      const verb = s === "reading" ? "开始读" : s === "done" ? "读完了" : "放上书架";
      return { date, verb, title: e.title, href: `/papers#${e.id}`, tone: "blue" };
    }
    case "question":
      return { date, verb: "提出问题", title: e.title, href: `/questions#${e.id}`, tone: "signal" };
    case "devlog":
      return { date, verb: "写了日志", title: e.title, href: `/log#${e.id}`, tone: "violet" };
    case "learn":
      return { date, verb: "学习记录", title: e.title, href: `/learn#${e.id}`, tone: "violet" };
    default:
      return null;
  }
}

function buildModel(entries: Entry[], today: string): Model {
  const of = (kind: Entry["kind"]) => entries.filter((e) => e.kind === kind);
  const weeks = of("week").sort((a, b) => a.sort - b.sort);
  const tasks = of("task");
  const tasksByWeek = new Map<string, Entry[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = tasksByWeek.get(t.parentId) ?? [];
    list.push(t);
    tasksByWeek.set(t.parentId, list);
  }
  for (const list of tasksByWeek.values()) list.sort((a, b) => a.sort - b.sort);

  const stateOf = (w: Entry): WeekState =>
    today < String(w.data.start ?? "") ? "future" : today > String(w.data.end ?? "") ? "done" : "current";
  const focusWeek = weeks.find((w) => stateOf(w) === "current") ?? weeks.find((w) => stateOf(w) === "future") ?? weeks.at(-1) ?? null;

  const pipe: PipeWeek[] = weeks.map((w, i) => {
    const list = tasksByWeek.get(w.id) ?? [];
    return { id: w.id, number: weekNumber(w, i), title: w.title, done: list.filter(isDone).length, total: list.length, state: stateOf(w) };
  });

  const recentSource = entries.filter((e) => e.kind !== "profile" && e.kind !== "week" && e.kind !== "journal");
  const recent = [...recentSource]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.sort - a.sort)
    .slice(0, 6)
    .map(recentItem)
    .filter((x): x is TimelineItem => x !== null);
  const lastUpdate = entries.reduce((max, e) => (e.updatedAt > max ? e.updatedAt : max), "");

  return {
    today,
    weeks,
    tasksByWeek,
    stateOf,
    focusWeek,
    pipe,
    papers: of("paper").sort(byPaperStatus),
    questions: of("question"),
    logs: of("devlog").sort(byDateDesc),
    learns: of("learn").sort(byDateDesc),
    journals: of("journal"),
    tasksDone: tasks.filter(isDone).length,
    tasksTotal: tasks.length,
    recent,
    lastUpdate,
  };
}

async function loadModel(c: Context<AppEnv>) {
  const db = c.env.DB;
  const [site, entries] = await Promise.all([loadSite(db), listEntries(db, { includePrivate: false, limit: 1000 })]);
  const today = todayInShanghai();
  return { site, entries, model: buildModel(entries, today) };
}

// 还没有公开内容的栏目：导航里先不显示，免得点进去是空页面
function emptyNav(model: Model): string[] {
  const counts: [string, number][] = [
    ["/plan", model.weeks.length],
    ["/papers", model.papers.length],
    ["/questions", model.questions.length],
    ["/log", model.logs.length],
    ["/learn", model.learns.length],
  ];
  return counts.filter(([, n]) => n === 0).map(([href]) => href);
}

const STATE_CHIP: Record<WeekState, { tone: Tone; text: string }> = {
  current: { tone: "signal", text: "本周" },
  done: { tone: "accent", text: "已过" },
  future: { tone: "muted", text: "未开始" },
};

// ---------- 首页 ----------

pages.get("/", async (c) => {
  const { site, entries, model } = await loadModel(c);
  const graph = buildGraph(entries, "我", model.today);
  const week = model.focusWeek;
  const weekTasks = week ? (model.tasksByWeek.get(week.id) ?? []) : [];
  const weekDone = weekTasks.filter(isDone).length;
  const weekState = week ? model.stateOf(week) : "future";
  const weekIndex = week ? model.weeks.indexOf(week) : -1;
  const reading = model.papers.filter((p) => p.data.status === "reading").length;
  const read = model.papers.filter((p) => p.data.status === "done").length;
  const currentPipe = model.pipe.find((p) => p.state === "current");

  return c.html(
    <Layout site={site} path="/" authed={c.get("authed")} hiddenNav={emptyNav(model)}>
      <section class="hero">
        <div class="panel frame hero-intro reveal">
          <p class="eyebrow">
            学习主页{week ? ` · 第 ${weekNumber(week, weekIndex)} 周` : ""}
          </p>
          <h1 class="hero-title">{site.title}</h1>
          <div class="hero-bio">
            <Markdown text={site.bio} />
          </div>
          {site.links.length ? (
            <p class="hero-links">
              {site.links.map((l) => (
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          ) : null}
          {week ? (
            <a class="instrument" href={`/plan#${week.id}`}>
              <ProgressRing done={weekDone} total={weekTasks.length} />
              <span class="instrument-text">
                <span class="eyebrow">
                  {weekState === "current" ? "本周" : weekState === "future" ? "下一周" : "最近一周"} · {weekRange(week)}
                </span>
                <span class="instrument-title">{week.title}</span>
                <span class="instrument-sub">
                  还剩 {weekTasks.length - weekDone} 项 <span aria-hidden="true">→</span>
                </span>
              </span>
            </a>
          ) : null}
          <div class="stats">
            <Stat value={`${model.tasksDone}/${model.tasksTotal}`} label="任务完成" />
            <Stat value={`${reading}·${read}`} label="在读 · 读完" />
            <Stat value={String(model.questions.length)} label="研究问题" />
          </div>
          <dl class="title-strip">
            <div>
              <dt>更新</dt>
              <dd>{model.lastUpdate ? formatShanghai(model.lastUpdate) : "—"}</dd>
            </div>
            <div>
              <dt>周数</dt>
              <dd>{model.weeks.length}</dd>
            </div>
            <div>
              <dt>图谱节点</dt>
              <dd>{graph.nodes.length}</dd>
            </div>
          </dl>
        </div>
        <GraphPanel graph={graph} />
      </section>

      {model.pipe.length ? (
        <section class="section reveal" aria-labelledby="progress-title">
          <SectionHead
            id="progress-title"
            title="学习进度"
            note={`共 ${model.pipe.length} 周${currentPipe ? ` · 第 ${currentPipe.number} 周进行中` : ""}`}
            href="/plan"
            linkText="完整计划"
          />
          <div class="panel pipeline-panel">
            <Pipeline weeks={model.pipe} />
          </div>
        </section>
      ) : null}

      <section class="section split reveal">
        {week ? (
          <div class="panel week-panel">
            <SectionHead title={`${weekState === "current" ? "本周" : "下一周"} · ${week.title}`} note={weekRange(week)} />
            <div class="bar-row">
              <Bar done={weekDone} total={weekTasks.length} />
              <span class="bar-count">
                {weekDone}/{weekTasks.length}
              </span>
            </div>
            <TaskChecklist tasks={weekTasks} />
          </div>
        ) : null}
        <div class="panel">
          <SectionHead title="最近更新" note={model.recent.length ? `最近 ${model.recent.length} 条` : undefined} />
          {model.recent.length ? <Timeline items={model.recent} /> : <EmptyState text="还没有公开的更新。" />}
        </div>
      </section>

      {model.papers.length ? (
        <section class="section reveal" aria-labelledby="shelf-title">
          <SectionHead id="shelf-title" title="书架" note={`${model.papers.length} 篇`} href="/papers" linkText="全部论文" />
          <div class="shelf">
            {model.papers.slice(0, 10).map((p) => (
              <PaperCard paper={p} compact />
            ))}
          </div>
        </section>
      ) : null}

      {model.questions.length ? (
        <section class="section reveal" aria-labelledby="questions-title">
          <SectionHead id="questions-title" title="研究问题" note={`${model.questions.length} 个`} href="/questions" />
          <div class="card-grid">
            {model.questions.slice(0, 3).map((q) => (
              <QuestionCard q={q} anchor={false} />
            ))}
          </div>
        </section>
      ) : null}

      {model.logs.length || model.learns.length ? (
        <section class="section split reveal">
          {model.logs.length ? (
            <div class="panel">
              <SectionHead title="开发日志" href="/log" />
              <LogList entries={model.logs.slice(0, 3)} />
            </div>
          ) : null}
          {model.learns.length ? (
            <div class="panel">
              <SectionHead title="学习记录" href="/learn" />
              <LogList entries={model.learns.slice(0, 3)} />
            </div>
          ) : null}
        </section>
      ) : null}
    </Layout>,
  );
});

const LogList: FC<{ entries: Entry[] }> = ({ entries }) => (
  <ul class="mini-log">
    {entries.map((e) => (
      <li>
        <span class="tl-date">{shortDate(entryDate(e))}</span>
        <a href={`/${e.kind === "devlog" ? "log" : "learn"}#${e.id}`}>{e.title}</a>
      </li>
    ))}
  </ul>
);

// ---------- 计划 ----------

pages.get("/plan", async (c) => {
  const { site, model } = await loadModel(c);
  return c.html(
    <Layout site={site} title="计划" path="/plan" authed={c.get("authed")} hiddenNav={emptyNav(model)}>
      <header class="page-head reveal">
        <p class="eyebrow">
          共 {model.weeks.length} 周 · 完成 {model.tasksDone}/{model.tasksTotal} 项任务
        </p>
        <h1>学习计划</h1>
        <p class="lede">按周排，每周三四件事。管道里的流动只流到本周，后面的周还没开始。</p>
      </header>
      {model.pipe.length ? (
        <section class="panel pipeline-panel reveal" aria-label="学习进度流程线">
          <Pipeline weeks={model.pipe} />
        </section>
      ) : null}
      {model.weeks.length ? (
        <div class="week-grid">
          {model.weeks.map((w, i) => {
            const list = model.tasksByWeek.get(w.id) ?? [];
            const done = list.filter(isDone).length;
            const state = model.stateOf(w);
            const journal = model.journals.find((j) => j.parentId === w.id && j.body.trim());
            return (
              <article class={`card week-card is-${state} reveal`} id={w.id}>
                <header class="week-card-head">
                  <Bubble top="WK" bottom={weekNumber(w, i)} />
                  <div class="week-card-title">
                    <span class="mono-note">{weekRange(w)}</span>
                    <h2>{w.title}</h2>
                  </div>
                  <Chip tone={STATE_CHIP[state].tone}>{STATE_CHIP[state].text}</Chip>
                </header>
                <div class="bar-row">
                  <Bar done={done} total={list.length} />
                  <span class="bar-count">
                    {done}/{list.length}
                  </span>
                </div>
                <Markdown text={w.body} />
                <TaskChecklist tasks={list} />
                {journal ? (
                  <div class="journal">
                    <p class="eyebrow">周记</p>
                    <Markdown text={journal.body} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState text="还没有公开的计划。" />
      )}
    </Layout>,
  );
});

// ---------- 论文 ----------

pages.get("/papers", async (c) => {
  const { site, model } = await loadModel(c);
  const count = (s: string) => model.papers.filter((p) => String(p.data.status ?? "shelf") === s).length;
  return c.html(
    <Layout site={site} title="论文" path="/papers" authed={c.get("authed")} hiddenNav={emptyNav(model)}>
      <header class="page-head reveal">
        <p class="eyebrow">
          {model.papers.length} 篇 · 在读 {count("reading")} · 读完 {count("done")}
        </p>
        <h1>论文</h1>
        <p class="lede">在读、待读和读完的论文。卡片上的「读书笔记」可以展开。</p>
      </header>
      {model.papers.length ? (
        <>
          <div class="filter-tabs reveal" role="group" aria-label="按状态筛选">
            <button type="button" data-filter="all" aria-pressed="true">
              全部 <span class="count">{model.papers.length}</span>
            </button>
            {PAPER_ORDER.map((s) => (
              <button type="button" data-filter={s} aria-pressed="false">
                {STATUS_LABELS[s]} <span class="count">{count(s)}</span>
              </button>
            ))}
          </div>
          <div class="card-grid papers-grid">
            {model.papers.map((p) => (
              <PaperCard paper={p} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState text="还没有公开的论文。" />
      )}
    </Layout>,
  );
});

// ---------- 研究问题 ----------

const QUESTION_TONE: Record<string, Tone> = { want: "signal", open: "muted", discussed: "accent", dropped: "muted" };

pages.get("/questions", async (c) => {
  const { site, model } = await loadModel(c);
  return c.html(
    <Layout site={site} title="研究问题" path="/questions" authed={c.get("authed")} hiddenNav={emptyNav(model)}>
      <header class="page-head reveal">
        <p class="eyebrow">{model.questions.length} 个问题</p>
        <h1>研究问题</h1>
        <p class="lede">读论文和做项目时冒出来的问题，研究方向会从这里选。</p>
      </header>
      {model.questions.length ? (
        <div class="board reveal">
          {QUESTION_ORDER.map((status) => {
            const items = model.questions.filter((q) => String(q.data.status ?? "open") === status);
            return (
              <section class={`board-col is-${status}`} aria-label={STATUS_LABELS[status]}>
                <h2 class="board-head">
                  <Chip tone={QUESTION_TONE[status] ?? "muted"}>{STATUS_LABELS[status]}</Chip>
                  <span class="count">{items.length}</span>
                </h2>
                {items.length ? items.map((q) => <QuestionCard q={q} />) : <p class="board-empty">暂无</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState text="还没有公开的研究问题。" />
      )}
    </Layout>,
  );
});

// ---------- 开发日志 / 学习记录 ----------

function timelinePage(kind: Extract<ListKind, "devlog" | "learn">, intro: string) {
  return async (c: Context<AppEnv>) => {
    const { site, model } = await loadModel(c);
    const meta = KIND_META[kind];
    const entries = kind === "devlog" ? model.logs : model.learns;
    return c.html(
      <Layout site={site} title={meta.plural} path={`/${meta.path}`} authed={c.get("authed")} hiddenNav={emptyNav(model)}>
        <header class="page-head reveal">
          <p class="eyebrow">{entries.length} 条</p>
          <h1>{meta.plural}</h1>
          <p class="lede">{intro}</p>
        </header>
        {entries.length ? (
          <ol class="log-timeline">
            {entries.map((e) => (
              <li class="log-item reveal" id={e.id}>
                <time class="log-date" datetime={entryDate(e)}>
                  {entryDate(e)}
                </time>
                <article class="card log-card">
                  {typeof e.data.topic === "string" && e.data.topic ? <Chip tone="violet">{e.data.topic}</Chip> : null}
                  <h2 class="card-title">{e.title}</h2>
                  <Markdown text={e.body} />
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState text={`还没有公开的${meta.plural}。`} />
        )}
      </Layout>,
    );
  };
}

pages.get("/log", timelinePage("devlog", "做项目时每周的进展、遇到的问题和解决办法。"));
pages.get("/learn", timelinePage("learn", "系统学习一个主题时留下的记录。"));

// ---------- 找不到页面 ----------

export async function renderNotFound(c: Context<AppEnv>) {
  const { site, model } = await loadModel(c);
  return c.html(
    <Layout site={site} title="找不到页面" path={c.req.path} authed={c.get("authed")} hiddenNav={emptyNav(model)}>
      <header class="page-head reveal">
        <p class="eyebrow">404</p>
        <h1>找不到这个页面</h1>
        <p class="lede">地址可能写错了，或者这条内容已经删除、改成了私密。</p>
      </header>
      <a class="more" href="/">
        回主页
        <span aria-hidden="true">→</span>
      </a>
    </Layout>,
    404,
  );
}
