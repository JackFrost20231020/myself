import { z } from "zod";

// AIHOT 公开接口文档：https://aihot.news/openapi-v1.json
// 使用条款：个人非商业使用免费；公开转载需要书面授权。所以这些内容只在后台显示，不放到公开页面。
export const AIHOT_ITEMS_URL = "https://aihot.news/api/v1/items?mode=selected&window=24h&limit=20";

const ItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  source: z.object({ name: z.string() }).optional(),
  links: z.object({ aihot: z.string(), original: z.string().optional() }),
  publishedAt: z.string().nullable().optional(),
  discoveredAt: z.string().optional(),
  category: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
});

export type FeedItem = {
  source: string;
  id: string;
  title: string;
  summary: string | null;
  reason: string | null;
  url: string;
  originalUrl: string | null;
  sourceName: string | null;
  category: string | null;
  score: number | null;
  publishedAt: string | null;
  fetchedAt: string;
};

export const CATEGORY_LABELS: Record<string, string> = {
  "ai-models": "模型",
  "ai-products": "产品",
  industry: "行业",
  paper: "论文",
  tip: "教程",
};

// 宽松解析：单条格式不对就跳过，不影响其他条目。
export function parseAihotItems(json: unknown, fetchedAt: string): FeedItem[] {
  const list = (json as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  const items: FeedItem[] = [];
  for (const raw of list) {
    const parsed = ItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const it = parsed.data;
    items.push({
      source: "aihot",
      id: it.id,
      title: it.title,
      summary: it.summary ?? null,
      reason: it.reason ?? null,
      url: it.links.aihot,
      originalUrl: it.links.original ?? null,
      sourceName: it.source?.name ?? null,
      category: it.category ?? null,
      score: it.score ?? null,
      publishedAt: it.publishedAt ?? it.discoveredAt ?? null,
      fetchedAt,
    });
  }
  return items;
}

export async function refreshAihot(
  db: D1Database,
  fetchImpl: typeof fetch = fetch,
): Promise<{ stored: number }> {
  const res = await fetchImpl(AIHOT_ITEMS_URL, {
    headers: { accept: "application/json", "user-agent": "zhishitupu-site/0.1 (personal study page)" },
  });
  if (!res.ok) throw new Error(`AIHOT 返回了 ${res.status}`);
  const fetchedAt = new Date().toISOString();
  const items = parseAihotItems(await res.json(), fetchedAt);
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const statements = items.map((it) =>
    db
      .prepare(
        `INSERT INTO feed_items (source, id, title, summary, reason, url, original_url, source_name, category, score, published_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source, id) DO UPDATE SET title = excluded.title, summary = excluded.summary, reason = excluded.reason,
           score = excluded.score, category = excluded.category, fetched_at = excluded.fetched_at`,
      )
      .bind(it.source, it.id, it.title, it.summary, it.reason, it.url, it.originalUrl, it.sourceName, it.category, it.score, it.publishedAt, it.fetchedAt),
  );
  statements.push(db.prepare("DELETE FROM feed_items WHERE fetched_at < ?").bind(cutoff));
  await db.batch(statements);
  return { stored: items.length };
}

type FeedRow = {
  source: string;
  id: string;
  title: string;
  summary: string | null;
  reason: string | null;
  url: string;
  original_url: string | null;
  source_name: string | null;
  category: string | null;
  score: number | null;
  published_at: string | null;
  fetched_at: string;
};

export async function listFeed(db: D1Database, limit = 20): Promise<FeedItem[]> {
  const { results } = await db
    .prepare("SELECT * FROM feed_items ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?")
    .bind(limit)
    .all<FeedRow>();
  return results.map((r) => ({
    source: r.source,
    id: r.id,
    title: r.title,
    summary: r.summary,
    reason: r.reason,
    url: r.url,
    originalUrl: r.original_url,
    sourceName: r.source_name,
    category: r.category,
    score: r.score,
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
  }));
}
