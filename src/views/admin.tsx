import { Hono, type Context } from "hono";
import type { FC } from "hono/jsx";
import { formatShanghai, todayInShanghai } from "../dates";
import type { AppEnv } from "../env";
import { CATEGORY_LABELS, type FeedItem, listFeed } from "../feed";
import {
  KIND_META,
  PAPER_STATUSES,
  QUESTION_STATUSES,
  STATUS_LABELS,
  isHttpUrl,
  kindFromPath,
  type ListKind,
} from "../kinds";
import { type Edit, type Entry, findWeekByDate, getEntry, listEdits, listEntries } from "../store";
import { Bubble, Empty, Layout, isDone, siteFromProfile, weekNumber } from "./layout";

// 后台：只有登录后才能进。所有改动走 /api，由 public/admin.js 发请求。
export const admin = new Hono<AppEnv>();

admin.use("*", async (c, next) => {
  if (c.req.path === "/admin/login" || c.get("authed")) return next();
  return c.redirect("/admin/login", 303);
});

async function loadSite(c: Context<AppEnv>) {
  return siteFromProfile(await getEntry(c.env.DB, "profile"));
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- 小组件 ----------

const VisSelect: FC<{ entry: Entry }> = ({ entry }) => (
  <select data-field="visibility" aria-label="谁能看到" class={`vis-select vis-${entry.visibility}`}>
    <option value="public" selected={entry.visibility === "public"}>
      公开
    </option>
    <option value="private" selected={entry.visibility === "private"}>
      私密
    </option>
  </select>
);

const SaveState: FC = () => <span class="save-state" aria-live="polite"></span>;

const StatusSelect: FC<{ entry: Entry; statuses: readonly string[]; fallback: string }> = ({ entry, statuses, fallback }) => (
  <label>
    状态
    <select data-field="data.status">
      {statuses.map((s) => (
        <option value={s} selected={(str(entry.data.status) || fallback) === s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  </label>
);

function linksText(links: unknown): string {
  if (!Array.isArray(links)) return "";
  return links
    .map((l) => {
      const link = l as { label?: unknown; url?: unknown };
      return `${str(link.label)} | ${str(link.url)}`;
    })
    .join("\n");
}

const EntryEditor: FC<{ entry: Entry }> = ({ entry }) => {
  const meta = KIND_META[entry.kind];
  const d = entry.data;
  const isProfile = entry.kind === "profile";
  return (
    <article class="editor card" data-entry={entry.id} data-version={String(entry.version)}>
      <div class="editor-row">
        <input class="title-input" data-field="title" value={entry.title} aria-label={meta.titleLabel} placeholder={meta.titleLabel} />
        {isProfile ? null : <VisSelect entry={entry} />}
        {isProfile ? null : (
          <button type="button" class="ghost danger" data-action="delete">
            删除
          </button>
        )}
      </div>
      <div class="editor-fields">
        {entry.kind === "paper" ? (
          <>
            <label>
              链接
              <input type="url" data-field="data.url" value={str(d.url)} placeholder="https://" />
            </label>
            <label>
              出处
              <input data-field="data.venue" value={str(d.venue)} placeholder="例如 ICLR 2023" />
            </label>
            <StatusSelect entry={entry} statuses={PAPER_STATUSES} fallback="shelf" />
            <label>
              计划在
              <input data-field="data.week" value={str(d.week)} placeholder="例如 第 2 周" />
            </label>
          </>
        ) : null}
        {entry.kind === "question" ? <StatusSelect entry={entry} statuses={QUESTION_STATUSES} fallback="open" /> : null}
        {entry.kind === "devlog" || entry.kind === "learn" ? (
          <label>
            日期
            <input type="date" data-field="data.date" value={str(d.date)} />
          </label>
        ) : null}
        {entry.kind === "learn" ? (
          <label>
            主题
            <input data-field="data.topic" value={str(d.topic)} placeholder="例如 Neo4j" />
          </label>
        ) : null}
      </div>
      {meta.bodyLabel ? (
        <label class="body-label">
          {meta.bodyLabel}（支持简单的 Markdown）
          <textarea data-field="body" rows={entry.body ? 7 : 3}>
            {entry.body}
          </textarea>
        </label>
      ) : null}
      {isProfile ? (
        <label class="body-label">
          链接（每行一个，写成「名称 | 网址」）
          <textarea data-field="data.links" rows={3} placeholder="GitHub | https://github.com/你的用户名">
            {linksText(d.links)}
          </textarea>
        </label>
      ) : null}
      <SaveState />
    </article>
  );
};

const TaskRow: FC<{ task: Entry }> = ({ task }) => (
  <li class={isDone(task) ? "task-row is-done" : "task-row"} data-entry={task.id} data-version={String(task.version)}>
    <input type="checkbox" data-field="data.done" checked={isDone(task)} aria-label="完成" />
    <input class="task-input" data-field="title" value={task.title} aria-label="任务内容" />
    <VisSelect entry={task} />
    <button type="button" class="ghost danger icon" data-action="delete" aria-label="删除这个任务">
      ×
    </button>
    <SaveState />
  </li>
);

const JournalEditor: FC<{ journal: Entry }> = ({ journal }) => (
  <div class="editor journal-editor" data-entry={journal.id} data-version={String(journal.version)}>
    <div class="editor-row">
      <span class="field-label">周记</span>
      <VisSelect entry={journal} />
      <SaveState />
    </div>
    <textarea data-field="body" rows={4} placeholder="做了什么 / 卡在哪 / 冒出来的一个问题" aria-label="周记">
      {journal.body}
    </textarea>
  </div>
);

const WeekEditor: FC<{ week: Entry; index: number; tasks: Entry[]; journal?: Entry; isNow: boolean }> = ({
  week,
  index,
  tasks,
  journal,
  isNow,
}) => (
  <section class={isNow ? "week-editor is-now" : "week-editor"} id={week.id}>
    <div class="editor week-fields" data-entry={week.id} data-version={String(week.version)}>
      <Bubble top="WK" bottom={weekNumber(week, index)} />
      <input class="title-input" data-field="title" value={week.title} aria-label="这一周的主题" />
      <input type="date" data-field="data.start" value={str(week.data.start)} aria-label="开始日期" />
      <input type="date" data-field="data.end" value={str(week.data.end)} aria-label="结束日期" />
      <VisSelect entry={week} />
      {isNow ? <span class="now">本周</span> : null}
      <span class="count" data-week-count>
        {tasks.filter(isDone).length} / {tasks.length}
      </span>
      <button type="button" class="ghost danger" data-action="delete">
        删除这周
      </button>
      <SaveState />
    </div>
    <ul class="task-rows">
      {tasks.map((t) => (
        <TaskRow task={t} />
      ))}
    </ul>
    <form class="add-form inline" data-create="task" data-parent={week.id}>
      <input name="title" placeholder="加一个任务，回车保存" required aria-label="新任务" />
      <button type="submit">添加</button>
    </form>
    {journal ? (
      <JournalEditor journal={journal} />
    ) : (
      <form class="add-form" data-create="journal" data-parent={week.id}>
        <button type="submit" class="ghost">
          写这周的周记
        </button>
      </form>
    )}
  </section>
);

const AddForm: FC<{ kind: ListKind; compact?: boolean }> = ({ kind, compact }) => {
  const meta = KIND_META[kind];
  return (
    <form class={compact ? "add-form card compact" : "add-form card"} data-create={kind}>
      <h3>新{meta.label}</h3>
      <input name="title" placeholder={meta.titleLabel} required aria-label={meta.titleLabel} />
      {kind === "paper" ? <input name="data.url" type="url" placeholder="链接（可选）" aria-label="链接" /> : null}
      {kind === "devlog" || kind === "learn" ? <input name="data.date" type="date" value={todayInShanghai()} aria-label="日期" /> : null}
      <div class="add-row">
        <select name="visibility" aria-label="谁能看到">
          <option value="private" selected={meta.defaultVisibility === "private"}>
            私密
          </option>
          <option value="public" selected={meta.defaultVisibility === "public"}>
            公开
          </option>
        </select>
        <button type="submit" class="primary">
          添加
        </button>
      </div>
    </form>
  );
};

const OP_LABELS: Record<string, string> = { create: "新建", update: "修改", delete: "删除" };
const ACTOR_LABELS: Record<string, string> = { web: "网页", claude: "Claude", cli: "命令行", cron: "定时任务", seed: "初始化" };
const FIELD_LABELS: Record<string, string> = { title: "标题", body: "内容", visibility: "公开范围", parentId: "所属周", sort: "顺序" };
const DATA_LABELS: Record<string, string> = {
  done: "完成状态",
  status: "状态",
  url: "链接",
  venue: "出处",
  week: "计划周",
  start: "开始日期",
  end: "结束日期",
  date: "日期",
  topic: "主题",
  links: "链接",
};

function changedFields(edit: Edit): string {
  const { before, after } = edit;
  if (edit.op !== "update" || !before || !after) return "";
  const out: string[] = [];
  for (const key of ["title", "body", "visibility", "parentId", "sort"] as const) {
    if (before[key] !== after[key]) out.push(FIELD_LABELS[key] ?? key);
  }
  const keys = new Set([...Object.keys(before.data ?? {}), ...Object.keys(after.data ?? {})]);
  for (const key of keys) {
    if (JSON.stringify(before.data?.[key]) !== JSON.stringify(after.data?.[key])) out.push(DATA_LABELS[key] ?? key);
  }
  return out.join("、");
}

const EditsTable: FC<{ edits: Edit[] }> = ({ edits }) =>
  edits.length ? (
    <div class="table-scroll">
      <table class="edits">
        <thead>
          <tr>
            <th>时间</th>
            <th>来源</th>
            <th>操作</th>
            <th>内容</th>
            <th>改了什么</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {edits.map((e) => {
            const snap = e.after ?? e.before;
            return (
              <tr class={e.undoneBy ? "is-undone" : undefined}>
                <td class="num">{formatShanghai(e.at)}</td>
                <td>{ACTOR_LABELS[e.actor] ?? e.actor}</td>
                <td>{e.undoOf ? `撤销 #${e.undoOf}` : OP_LABELS[e.op]}</td>
                <td>
                  {snap ? (
                    <>
                      <span class="kind">{KIND_META[snap.kind]?.label ?? snap.kind}</span>{" "}
                      {snap.title || (snap.kind === "journal" && snap.parentId ? `${snap.parentId} 的周记` : "（无标题）")}
                    </>
                  ) : (
                    e.entryId
                  )}
                </td>
                <td>{changedFields(e)}</td>
                <td class="actions">
                  <span class="num muted">#{e.id}</span>
                  {e.undoneBy ? (
                    <span class="muted">已撤销</span>
                  ) : (
                    <button type="button" class="ghost" data-undo={String(e.id)}>
                      撤销
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="还没有修改记录。" />
  );

const FeedList: FC<{ items: FeedItem[] }> = ({ items }) =>
  items.length ? (
    <ul class="items feed">
      {items.map((it) => (
        <li class="item">
          <div class="item-head">
            {it.category ? <span class="status">{CATEGORY_LABELS[it.category] ?? it.category}</span> : null}
            {isHttpUrl(it.url) ? (
              <a class="item-title" href={it.url} target="_blank" rel="noopener noreferrer">
                {it.title}
              </a>
            ) : (
              <span class="item-title">{it.title}</span>
            )}
          </div>
          <p class="item-meta">{[it.sourceName, formatShanghai(it.publishedAt)].filter(Boolean).join(" · ")}</p>
          {it.reason ? <p class="reason">{it.reason}</p> : it.summary ? <p class="reason">{it.summary}</p> : null}
        </li>
      ))}
    </ul>
  ) : (
    <Empty text="还没有拉取过。点「立即更新」，或者等每天早上 8:30 的定时任务。" />
  );

// ---------- 页面 ----------

admin.get("/login", async (c) => {
  if (c.get("authed")) return c.redirect("/admin", 303);
  const site = await loadSite(c);
  const error = c.req.query("error");
  const message =
    error === "wrong"
      ? "密码不对，再试一次。"
      : error === "locked"
        ? "失败次数太多，请 15 分钟后再试。"
        : error === "not-configured"
          ? "还没有设置后台密码（ADMIN_PASSWORD 和 SESSION_SECRET）。"
          : null;
  return c.html(
    <Layout site={site} title="登录" path="/admin/login" authed={false}>
      <section class="login card">
        <h1>登录后台</h1>
        {message ? (
          <p class="error" role="alert">
            {message}
          </p>
        ) : null}
        <form method="post" action="/admin/login" class="login-form">
          <label for="password">后台密码</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
          <button type="submit" class="primary">
            登录
          </button>
        </form>
      </section>
    </Layout>,
  );
});

async function weekContext(db: D1Database) {
  const weeks = await listEntries(db, { kind: "week", includePrivate: true });
  const [tasks, journals] = await Promise.all([
    listEntries(db, { kind: "task", includePrivate: true }),
    listEntries(db, { kind: "journal", includePrivate: true }),
  ]);
  return { weeks, tasks, journals };
}

admin.get("/", async (c) => {
  const db = c.env.DB;
  const site = await loadSite(c);
  const today = todayInShanghai();
  const current = await findWeekByDate(db, today, true);
  const { weeks, tasks, journals } = await weekContext(db);
  const edits = await listEdits(db, { limit: 8 });
  const index = current ? weeks.findIndex((w) => w.id === current.id) : -1;

  return c.html(
    <Layout site={site} title="概览" path="/admin" authed admin>
      <div class="page-head">
        <h1>概览</h1>
        <p class="lede">今天是 {today}。在这里改的内容会立即出现在公开页上（私密的除外）。</p>
      </div>
      {current ? (
        <WeekEditor
          week={current}
          index={index}
          tasks={tasks.filter((t) => t.parentId === current.id)}
          journal={journals.find((j) => j.parentId === current.id)}
          isNow
        />
      ) : (
        <Empty text="今天不在任何一周里。去「计划」里加一周。" />
      )}
      <section class="block">
        <h2>快速添加</h2>
        <div class="quick-grid">
          <AddForm kind="question" compact />
          <AddForm kind="paper" compact />
          <AddForm kind="devlog" compact />
          <AddForm kind="learn" compact />
        </div>
      </section>
      <section class="block">
        <div class="block-head">
          <h2>最近修改</h2>
          <a href="/admin/history">全部 →</a>
        </div>
        <EditsTable edits={edits} />
      </section>
    </Layout>,
  );
});

admin.get("/plan", async (c) => {
  const db = c.env.DB;
  const site = await loadSite(c);
  const today = todayInShanghai();
  const { weeks, tasks, journals } = await weekContext(db);
  const last = weeks[weeks.length - 1];
  const nextNumber = Math.max(-1, ...weeks.map((w) => Number(/^w(\d+)$/.exec(w.id)?.[1] ?? -1))) + 1;
  const nextStart = last && typeof last.data.end === "string" ? addDays(last.data.end, 1) : today;

  return c.html(
    <Layout site={site} title="计划" path="/admin/plan" authed admin>
      <div class="page-head">
        <h1>计划</h1>
        <p class="lede">每周的主题、任务和周记。任务默认公开，周记默认私密。</p>
      </div>
      {weeks.map((w, i) => (
        <WeekEditor
          week={w}
          index={i}
          tasks={tasks.filter((t) => t.parentId === w.id)}
          journal={journals.find((j) => j.parentId === w.id)}
          isNow={String(w.data.start) <= today && today <= String(w.data.end)}
        />
      ))}
      <form class="add-form card" data-create="week">
        <h3>加一周</h3>
        <input type="hidden" name="id" value={`w${nextNumber}`} />
        <input name="title" placeholder="这一周的主题" required aria-label="主题" />
        <div class="add-row">
          <label>
            开始
            <input name="data.start" type="date" value={nextStart} required />
          </label>
          <label>
            结束
            <input name="data.end" type="date" value={addDays(nextStart, 6)} required />
          </label>
          <select name="visibility" aria-label="谁能看到">
            <option value="public" selected>
              公开
            </option>
            <option value="private">私密</option>
          </select>
          <button type="submit" class="primary">
            添加
          </button>
        </div>
      </form>
    </Layout>,
  );
});

admin.get("/profile", async (c) => {
  const site = await loadSite(c);
  const profile = await getEntry(c.env.DB, "profile");
  return c.html(
    <Layout site={site} title="主页信息" path="/admin/profile" authed admin>
      <div class="page-head">
        <h1>主页信息</h1>
        <p class="lede">网站名称、简介和链接，显示在公开主页的最上面。不要写学号、电话这类隐私信息。</p>
      </div>
      {profile ? (
        <EntryEditor entry={profile} />
      ) : (
        <form class="add-form card" data-create="profile">
          <input name="title" placeholder="网站名称" required aria-label="网站名称" />
          <input type="hidden" name="visibility" value="public" />
          <button type="submit" class="primary">
            创建主页信息
          </button>
        </form>
      )}
    </Layout>,
  );
});

admin.get("/history", async (c) => {
  const site = await loadSite(c);
  const edits = await listEdits(c.env.DB, { limit: 100 });
  return c.html(
    <Layout site={site} title="修改历史" path="/admin/history" authed admin>
      <div class="page-head">
        <h1>修改历史</h1>
        <p class="lede">最近 100 次改动。撤销只在内容之后没被再改过时可用；撤销本身也会记一条，所以撤销错了还能再撤销回来。</p>
      </div>
      <EditsTable edits={edits} />
    </Layout>,
  );
});

admin.get("/feed", async (c) => {
  const site = await loadSite(c);
  const items = await listFeed(c.env.DB, 30);
  return c.html(
    <Layout site={site} title="AI 资讯" path="/admin/feed" authed admin>
      <div class="page-head">
        <h1>AI 资讯</h1>
        <p class="lede">
          每天早上 8:30 自动从 AIHOT 拉取过去 24 小时的精选。只有你能看到：AIHOT 的条款不允许未经授权公开转载。
        </p>
        <button type="button" class="primary" data-feed-refresh>
          立即更新
        </button>
      </div>
      <FeedList items={items} />
    </Layout>,
  );
});

admin.get("/:kindPath", async (c) => {
  const kind = kindFromPath(c.req.param("kindPath"));
  if (!kind) return c.notFound();
  const site = await loadSite(c);
  const meta = KIND_META[kind];
  const entries = await listEntries(c.env.DB, { kind, includePrivate: true });
  const ordered = kind === "devlog" || kind === "learn" ? [...entries].reverse() : entries;
  return c.html(
    <Layout site={site} title={meta.plural} path={`/admin/${meta.path}`} authed admin>
      <div class="page-head">
        <h1>{meta.plural}</h1>
        <p class="lede">
          新建的{meta.label}默认{meta.defaultVisibility === "public" ? "公开" : "私密"}，确认可以公开后再改成「公开」。
        </p>
      </div>
      <AddForm kind={kind} />
      {ordered.length ? ordered.map((e) => <EntryEditor entry={e} />) : <Empty text={`还没有${meta.plural}。`} />}
    </Layout>,
  );
});
