import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";
import { type GraphData, graphJson } from "../graph";
import { STATUS_LABELS, isHttpUrl } from "../kinds";
import type { Entry } from "../store";
import { Markdown, isDone } from "./layout";

export type Tone = "accent" | "signal" | "blue" | "violet" | "muted";

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export const Chip: FC<PropsWithChildren<{ tone?: Tone }>> = ({ tone = "muted", children }) => (
  <span class={`chip chip-${tone}`}>{children}</span>
);

export const SectionHead: FC<{ title: string; note?: string; href?: string; linkText?: string; id?: string }> = ({
  title,
  note,
  href,
  linkText,
  id,
}) => (
  <div class="section-head">
    <div class="section-title">
      <h2 id={id}>{title}</h2>
      {note ? <span class="section-note">{note}</span> : null}
    </div>
    {href ? (
      <a class="more" href={href}>
        {linkText ?? "全部"}
        <span aria-hidden="true">→</span>
      </a>
    ) : null}
  </div>
);

// 进度环：服务端直接画出最终值，site.js 再让它从 0 长到这个值。
export const ProgressRing: FC<{ done: number; total: number; size?: number }> = ({ done, total, size = 104 }) => {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const len = total ? (c * done) / total : 0;
  const mid = size / 2;
  return (
    <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`已完成 ${done} / ${total}`}>
      <circle class="ring-track" cx={mid} cy={mid} r={r} stroke-width={stroke} />
      <circle
        class="ring-value"
        cx={mid}
        cy={mid}
        r={r}
        stroke-width={stroke}
        stroke-dasharray={`${len.toFixed(2)} ${c.toFixed(2)}`}
        transform={`rotate(-90 ${mid} ${mid})`}
        data-len={len.toFixed(2)}
        data-circ={c.toFixed(2)}
      />
      <text class="ring-num" x={mid} y={mid - 4} text-anchor="middle" dominant-baseline="central">
        {done}/{total}
      </text>
      <text class="ring-label" x={mid} y={mid + 16} text-anchor="middle" dominant-baseline="central">
        已完成
      </text>
    </svg>
  );
};

export const Bar: FC<{ done: number; total: number }> = ({ done, total }) => (
  <progress class="bar" max={Math.max(total, 1)} value={done} data-animate aria-label={`已完成 ${done} / ${total}`}></progress>
);

export type PipeWeek = {
  id: string;
  number: string;
  title: string;
  done: number;
  total: number;
  state: "done" | "current" | "future";
};

// P&ID 流程线：每周一个仪表圆圈，用管道连起来；流动动画只流到本周。
export const Pipeline: FC<{ weeks: PipeWeek[] }> = ({ weeks }) => {
  const R = 24;
  const GAP = 156;
  // 第一周开始后，前面画一段进料管，一直在流动
  const inlet = weeks.length > 0 && weeks[0]?.state !== "future";
  const MX = inlet ? 112 : 70;
  const MR = 70;
  const CY = 46;
  const W = MX + MR + Math.max(weeks.length - 1, 0) * GAP;
  const H = 136;
  const current = weeks.find((w) => w.state === "current");
  return (
    <div class="pipeline-scroll" data-pipeline>
      <svg
        class="pipeline"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`学习进度：共 ${weeks.length} 周${current ? `，本周是第 ${current.number} 周「${current.title}」` : ""}`}
      >
        <defs>
          <marker id="pipe-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,1 L9,5 L0,9 z" class="pipe-arrow" />
          </marker>
          <marker id="pipe-arrow-future" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,1 L9,5 L0,9 z" class="pipe-arrow-future" />
          </marker>
        </defs>
        {inlet ? (
          <g class="pipe is-live pipe-inlet">
            <line class="pipe-flange" x1={16} y1={CY - 10} x2={16} y2={CY + 10} />
            <line class="pipe-body" x1={18} y1={CY} x2={MX - R - 9} y2={CY} marker-end="url(#pipe-arrow)" />
            <line class="pipe-flow" x1={20} y1={CY} x2={MX - R - 13} y2={CY} />
          </g>
        ) : null}
        {weeks.slice(1).map((w, i) => {
          const x1 = MX + i * GAP + R + 6;
          const x2 = MX + (i + 1) * GAP - R - 9;
          const live = w.state !== "future";
          return (
            <g class={live ? "pipe is-live" : "pipe is-future"}>
              <line class="pipe-body" x1={x1} y1={CY} x2={x2} y2={CY} marker-end={live ? "url(#pipe-arrow)" : "url(#pipe-arrow-future)"} />
              {live ? <line class="pipe-flow" x1={x1 + 2} y1={CY} x2={x2 - 4} y2={CY} /> : null}
            </g>
          );
        })}
        {weeks.map((w, i) => {
          const x = MX + i * GAP;
          const frac = w.total ? w.done / w.total : 0;
          return (
            <a class={`pipe-node is-${w.state}`} href={`/plan#${w.id}`} aria-label={`第 ${w.number} 周：${w.title}，完成 ${w.done}/${w.total}`}>
              {w.state === "current" ? <circle class="pipe-pulse" cx={x} cy={CY} r={R} /> : null}
              <circle class="pipe-bubble" cx={x} cy={CY} r={R} />
              <line class="pipe-bubble-line" x1={x - R + 2} y1={CY} x2={x + R - 2} y2={CY} />
              <text class="pipe-wk" x={x} y={CY - 8} text-anchor="middle" dominant-baseline="central">
                WK
              </text>
              <text class="pipe-no" x={x} y={CY + 10} text-anchor="middle" dominant-baseline="central">
                {w.number}
              </text>
              <text class="pipe-title" x={x} y={CY + R + 20} text-anchor="middle">
                {truncate(w.title, 9)}
              </text>
              <rect class="pipe-meter-track" x={x - 28} y={CY + R + 30} width={56} height={4} rx={2} />
              <rect class="pipe-meter" x={x - 28} y={CY + R + 30} width={Math.round(56 * frac)} height={4} rx={2} />
              <text class="pipe-count" x={x} y={CY + R + 50} text-anchor="middle">
                {w.done}/{w.total}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
};

export const TaskChecklist: FC<{ tasks: Entry[] }> = ({ tasks }) => (
  <ul class="checklist">
    {tasks.map((t) => (
      <li class={isDone(t) ? "check is-done" : "check"}>
        <span class="check-box" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
        <span class="check-text">{t.title}</span>
        <span class="sr-only">{isDone(t) ? "（已完成）" : "（未完成）"}</span>
      </li>
    ))}
  </ul>
);

export type TimelineItem = { date: string; verb: string; title: string; href: string; tone: Tone };

export const Timeline: FC<{ items: TimelineItem[] }> = ({ items }) => (
  <ol class="timeline">
    {items.map((it) => (
      <li class={`tl tl-${it.tone}`}>
        <span class="tl-date">{it.date}</span>
        <p class="tl-text">
          <span class="tl-verb">{it.verb}</span>
          <a href={it.href}>{it.title}</a>
        </p>
      </li>
    ))}
  </ol>
);

const PAPER_TONE: Record<string, Tone> = { reading: "accent", shelf: "blue", done: "muted" };

export const PaperCard: FC<{ paper: Entry; compact?: boolean }> = ({ paper, compact }) => {
  const url = typeof paper.data.url === "string" && isHttpUrl(paper.data.url) ? paper.data.url : null;
  const status = String(paper.data.status ?? "shelf");
  const week = typeof paper.data.week === "string" ? paper.data.week : "";
  const venue = typeof paper.data.venue === "string" ? paper.data.venue : "";
  return (
    <article class={`card paper-card is-${status}`} id={compact ? undefined : paper.id} data-status={status}>
      <div class="card-top">
        <Chip tone={PAPER_TONE[status] ?? "muted"}>{STATUS_LABELS[status] ?? status}</Chip>
        {week ? <span class="mono-note">{week}</span> : null}
      </div>
      <h3 class="card-title">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {paper.title}
          </a>
        ) : (
          paper.title
        )}
      </h3>
      {venue ? <p class="card-meta">{venue}</p> : null}
      {!compact && paper.body.trim() ? (
        <details class="notes">
          <summary>读书笔记</summary>
          <Markdown text={paper.body} />
        </details>
      ) : null}
    </article>
  );
};

export const QuestionCard: FC<{ q: Entry; anchor?: boolean }> = ({ q, anchor = true }) => (
  <article class="card question-card" id={anchor ? q.id : undefined}>
    <h3 class="card-title">{q.title}</h3>
    <Markdown text={q.body} />
  </article>
);

export const Stat: FC<{ value: string; label: string }> = ({ value, label }) => (
  <div class="stat">
    <span class="stat-value">{value}</span>
    <span class="stat-label">{label}</span>
  </div>
);

export const EmptyState: FC<{ text: string }> = ({ text }) => (
  <div class="empty-state">
    <p>{text}</p>
  </div>
);

// 学习图谱：数据以 JSON 嵌进页面，由 public/site.js 用 canvas 画出来。
export const GraphPanel: FC<{ graph: GraphData }> = ({ graph }) => (
  <section class="panel frame graph-panel reveal" aria-labelledby="graph-title">
    <div class="graph-head">
      <h2 id="graph-title" class="graph-title">学习图谱</h2>
      <ul class="legend" aria-label="图例">
        <li>
          <i class="dot dot-week"></i>周
        </li>
        <li>
          <i class="dot dot-task"></i>任务
        </li>
        <li>
          <i class="dot dot-paper"></i>论文
        </li>
        <li>
          <i class="dot dot-question"></i>问题
        </li>
        <li>
          <i class="dot dot-log"></i>日志
        </li>
      </ul>
    </div>
    <div class="graph-stage" data-graph>
      <canvas
        class="graph-canvas"
        role="img"
        aria-label={`学习图谱：${graph.nodes.length} 个节点、${graph.edges.length} 条关系。下面各个区块里有同样的内容。`}
      ></canvas>
      <div class="graph-tip" hidden></div>
      <noscript>
        <p class="graph-fallback">打开 JavaScript 后可以看到学习图谱。</p>
      </noscript>
    </div>
    <p class="graph-hint">拖动节点 · 悬停查看 · 点击打开</p>
    <script type="application/json" id="graph-data">
      {raw(graphJson(graph))}
    </script>
  </section>
);
