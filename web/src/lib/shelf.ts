import { PAPER_STATUSES } from "../../content/constants.ts";
import type { Paper } from "../../content/schema.ts";

// 在读排最前，其次想读，最后读完；同一组里保持内容文件里的顺序
export function sortPapers(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => PAPER_STATUSES.indexOf(a.status) - PAPER_STATUSES.indexOf(b.status));
}

export function groupPapers(papers: Paper[]): { status: Paper["status"]; papers: Paper[] }[] {
  return PAPER_STATUSES.map((status) => ({ status, papers: papers.filter((p) => p.status === status) }));
}

export function shelfSummary(papers: Paper[]): string {
  const parts = groupPapers(papers)
    .filter((g) => g.papers.length)
    .map((g) => `${g.status} ${g.papers.length}`);
  return parts.length ? parts.join(" · ") : "还没有论文";
}
